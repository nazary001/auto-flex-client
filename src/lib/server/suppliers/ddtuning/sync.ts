import type { AnyBulkWriteOperation, Db } from "mongodb";
import { GROUP_NAMES_UK, LEAF_NAMES_UK, translateValue } from "@/data/ddtuning/category-names.uk";
import type { Product } from "@/lib/types";
import { slugify } from "@/lib/slug";
import { applyLocalOverrides, productToDoc } from "@/lib/server/catalog/product-doc";
import { existingProductMeta, recountTaxonomy, writeProductDocs } from "@/lib/server/catalog/products";
import { invalidateTaxonomy } from "@/lib/server/catalog/taxonomy-cache";
import {
  cols,
  type BrandDoc,
  type CategoryDoc,
  type MakeDoc,
  type ModelDoc,
  type ProductDoc,
  type StagingDoc,
  type SyncPhase,
  type SyncRunDoc,
  type SupplierItem,
} from "@/lib/server/db/collections";
import { deleteOffersBySku, upsertOffers, type OfferInput } from "@/lib/server/db/repos/offers";
import { getSettings, saveSettings } from "@/lib/server/db/repos/settings";
import { createSupplier, getSupplierByCode } from "@/lib/server/db/repos/suppliers";
import { newId, nowIso } from "@/lib/server/db/util";
import { DD_PAGE_SIZE, fetchCategories, fetchPricePage, type RawCategories, type RawItem } from "./client";
import {
  buildProduct,
  makeSlugOf,
  modelSlugOf,
  pickBestCost,
  productIdFor,
  toSupplierItem,
  type BrandRef,
  type BuildContext,
  type CategoryRef,
  type ParsedModel,
  type PricingPolicy,
  type RawCost,
  type VehicleRef,
} from "./mapping";
import { fetchNbuRates, type Rates } from "./rates";

/*
 * Resumable, idempotent import of the whole DD Tuning catalog.
 *
 *   rates → categories → retail (→ staging) → wholesale (costs onto staging) → build (products)
 *   → taxonomy (brands / makes / models / counts) → offers → finalize (retire, clean up)
 *
 * Each phase works in pages or batches and persists its position in `sync_runs`, so a run can
 * be continued by another invocation (cron on Vercel) when the time budget is exhausted.
 */

export const DD_SUPPLIER_CODE = "DDT";
const PHASES: SyncPhase[] = ["rates", "categories", "retail", "wholesale", "build", "taxonomy", "offers", "finalize", "done"];
const BUILD_BATCH = 300;
const OFFER_BATCH = 2000;
const LOG_LIMIT = 300;

/*
 * Atlas free/shared clusters block ALL writes once the logical data size reaches the quota
 * (512 MB on M0), and the staging copy of the price list alone needs ~150 MB. Refuse to start
 * filling the database when it would not fit instead of taking the whole store down.
 */
const STORAGE_LIMIT_MB = Number(process.env.MONGODB_STORAGE_LIMIT_MB) || 512;
const SYNC_MIN_FREE_MB = Number(process.env.SYNC_MIN_FREE_MB) || 150;
const SYNC_PAGE_MIN_FREE_MB = 20;

async function assertStorageHeadroom(db: Db, neededMb: number): Promise<void> {
  const stats = await db.stats();
  const usedMb = Math.round((Number(stats.dataSize ?? 0) + Number(stats.indexSize ?? 0)) / 1048576);
  if (STORAGE_LIMIT_MB - usedMb < neededMb) {
    throw new SyncError(
      `Недостатньо місця в базі даних: зайнято ${usedMb} з ${STORAGE_LIMIT_MB} МБ, для синхронізації потрібно ще ~${neededMb} МБ. Звільніть місце або збільште кластер Atlas.`,
    );
  }
}

export interface SyncOptions {
  /** Stop (status "paused") after this many milliseconds; the next call continues */
  budgetMs?: number;
  /** Continue this run instead of starting a new one */
  runId?: string;
  log?: (text: string) => void;
}

export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncError";
  }
}

function nextPhase(phase: SyncPhase): SyncPhase {
  return PHASES[Math.min(PHASES.indexOf(phase) + 1, PHASES.length - 1)];
}

// ── registries (in-memory during a run, flushed to the DB) ──

class TaxonomyRegistry {
  categories = new Map<string, CategoryDoc>();
  private categoryByLower = new Map<string, CategoryDoc>(); // `${parentId}|${lower ru/uk title}` and leaf titles globally
  private leafByTitle = new Map<string, CategoryDoc[]>();
  private groupByTitle = new Map<string, CategoryDoc>();
  private slugs = new Set<string>();
  brands = new Map<string, BrandDoc>();
  makes = new Map<string, MakeDoc>();
  models = new Map<string, ModelDoc>();
  dirtyCategories = new Set<string>();
  dirtyBrands = new Set<string>();
  dirtyMakes = new Set<string>();
  dirtyModels = new Set<string>();

  constructor(private readonly now: string) {}

  async load(db: Db): Promise<void> {
    const c = cols(db);
    for (const doc of await c.categories.find().toArray()) this.indexCategory(doc);
    for (const doc of await c.brands.find().toArray()) this.brands.set(doc._id, doc);
    for (const doc of await c.makes.find().toArray()) this.makes.set(doc._id, doc);
    for (const doc of await c.models.find().toArray()) this.models.set(doc._id, doc);
  }

  private indexCategory(doc: CategoryDoc): void {
    this.categories.set(doc._id, doc);
    this.slugs.add(doc._id);
    const titles = new Set<string>([doc.name, doc.nameRu ?? ""].map((t) => t.trim().toLowerCase()).filter(Boolean));
    for (const title of titles) {
      this.categoryByLower.set(`${doc.parentId ?? ""}|${title}`, doc);
      if (doc.parentId === null) this.groupByTitle.set(title, doc);
      else {
        const list = this.leafByTitle.get(title) ?? [];
        if (!list.includes(doc)) list.push(doc);
        this.leafByTitle.set(title, list);
      }
    }
  }

  private uniqueSlug(base: string, fallbackSuffix?: string): string {
    let slug = base || "kategoriia";
    if (this.slugs.has(slug) && fallbackSuffix) slug = `${slug}-${fallbackSuffix}`;
    let n = 2;
    const root = slug;
    while (this.slugs.has(slug)) slug = `${root}-${n++}`;
    return slug;
  }

  /** Registers the supplier's official category tree */
  applyApiCategories(raw: RawCategories): void {
    const groupIds = Object.keys(raw).map(Number).sort((a, b) => a - b);
    groupIds.forEach((groupId, index) => {
      const entry = raw[String(groupId)];
      const meta = GROUP_NAMES_UK[groupId];
      const group = this.ensureCategory({
        supplierId: groupId,
        name: meta?.name ?? entry.title,
        nameRu: entry.title,
        parentId: null,
        icon: meta?.icon,
        description: meta?.description,
        sort: (index + 1) * 10,
      });
      const children = Object.entries(entry.children ?? {});
      children.forEach(([leafIdRaw, title], leafIndex) => {
        const leafId = Number(leafIdRaw);
        this.ensureCategory({
          supplierId: leafId,
          name: LEAF_NAMES_UK[leafId] ?? title,
          nameRu: title,
          parentId: group._id,
          sort: (leafIndex + 1) * 10,
        });
      });
    });
  }

  /** Group illustration from its icon (public/illustrations/dd-<icon>.svg); leaves inherit the one of their group */
  private illustrationFor(input: { parentId: string | null; icon?: string }): string {
    if (input.icon) return `dd-${input.icon}`;
    const group = input.parentId ? this.categories.get(input.parentId) : undefined;
    return group?.illustration ?? "_fallback";
  }

  private ensureCategory(input: { supplierId?: number; name: string; nameRu?: string; parentId: string | null; icon?: string; description?: string; sort?: number }): CategoryDoc {
    if (!input.name.trim()) {
      // never create nameless categories; file the item under the catch-all group / its "Інше" leaf
      const group = input.parentId ? this.categories.get(input.parentId) : undefined;
      if (group) return this.otherLeaf(group);
      input = { ...input, name: "Інші товари", nameRu: input.nameRu || "Інші товари", icon: "accessories", sort: 9999 };
    }
    const existing =
      (input.supplierId !== undefined && [...this.categories.values()].find((c) => c.supplierIds.includes(input.supplierId!))) ||
      this.categoryByLower.get(`${input.parentId ?? ""}|${input.name.trim().toLowerCase()}`) ||
      (input.nameRu ? this.categoryByLower.get(`${input.parentId ?? ""}|${input.nameRu.trim().toLowerCase()}`) : undefined);
    if (existing) {
      let changed = false;
      if (input.supplierId !== undefined && !existing.supplierIds.includes(input.supplierId)) {
        existing.supplierIds.push(input.supplierId);
        changed = true;
      }
      if (input.nameRu && existing.nameRu !== input.nameRu) {
        existing.nameRu = input.nameRu;
        changed = true;
      }
      if (input.name !== existing.name && !existing.local?.name && input.supplierId !== undefined) {
        existing.name = input.name;
        changed = true;
      }
      if (input.icon && !existing.icon) {
        existing.icon = input.icon;
        changed = true;
      }
      if (input.description && !existing.description) {
        existing.description = input.description;
        changed = true;
      }
      const illustration = this.illustrationFor(input);
      if (existing.illustration === "_fallback" && illustration !== "_fallback") {
        existing.illustration = illustration;
        changed = true;
      }
      if (changed) {
        existing.updatedAt = this.now;
        this.dirtyCategories.add(existing._id);
        this.indexCategory(existing);
      }
      return existing;
    }
    const parentSlug = input.parentId ?? undefined;
    const slug = this.uniqueSlug(slugify(input.name), parentSlug);
    const doc: CategoryDoc = {
      _id: slug,
      slug,
      name: input.name,
      parentId: input.parentId,
      illustration: this.illustrationFor(input),
      supplierIds: input.supplierId !== undefined ? [input.supplierId] : [],
      productCount: 0,
      sort: input.sort ?? 9990,
      hidden: false,
      updatedAt: this.now,
    };
    if (input.nameRu) doc.nameRu = input.nameRu;
    if (input.icon) doc.icon = input.icon;
    if (input.description) doc.description = input.description;
    this.indexCategory(doc);
    this.dirtyCategories.add(slug);
    return doc;
  }

  /** "Інше" leaf of a group, for items the supplier files directly under the group */
  private otherLeaf(group: CategoryDoc): CategoryDoc {
    const key = `${group._id}|інше`;
    const existing = this.categoryByLower.get(key);
    if (existing) return existing;
    const slug = this.uniqueSlug(`${group._id}-inshe`);
    const doc: CategoryDoc = {
      _id: slug,
      slug,
      name: "Інше",
      parentId: group._id,
      illustration: group.illustration,
      supplierIds: [],
      productCount: 0,
      sort: 9999,
      hidden: false,
      updatedAt: this.now,
    };
    this.indexCategory(doc);
    this.dirtyCategories.add(slug);
    return doc;
  }

  resolveCategory(category: string, subcategory: string): CategoryRef {
    const cat = category.trim();
    const sub = subcategory.trim();
    const catLower = cat.toLowerCase();
    const subLower = sub.toLowerCase();
    let group = this.groupByTitle.get(catLower);
    let leaf: CategoryDoc | undefined;
    if (group && sub) leaf = this.categoryByLower.get(`${group._id}|${subLower}`);
    if (!leaf && sub) leaf = this.leafByTitle.get(subLower)?.[0];
    if (!leaf && !sub) {
      // the "category" itself may be a leaf title ("Тюнинг решетки")
      leaf = this.leafByTitle.get(catLower)?.[0];
    }
    if (!leaf && sub && this.groupByTitle.get(subLower)) {
      // subcategory names a whole group ("Хром накладки" under interior accessories): file it under that group
      group = this.groupByTitle.get(subLower)!;
    }
    // a leaf carrying its group's own title is a leftover of an earlier run — use the group's "Інше" instead
    if (leaf && group && leaf.parentId === group._id && (leaf.nameRu ?? leaf.name).trim().toLowerCase() === catLower && !sub) {
      leaf = this.otherLeaf(group);
    }
    if (!group && leaf) group = this.categories.get(leaf.parentId ?? "") ?? undefined;
    if (!group) {
      // unknown or empty group title → a real group when named, otherwise the catch-all group
      group = cat
        ? this.ensureCategory({ name: translateValue(cat) ?? cat, nameRu: cat, parentId: null })
        : this.ensureCategory({ name: "Інші товари", nameRu: "Інші товари", parentId: null, icon: "accessories", sort: 9999 });
    }
    if (!leaf) {
      // a named subcategory the supplier's tree does not list → new leaf; otherwise the group's "Інше"
      leaf = sub && subLower !== catLower && !this.groupByTitle.get(subLower)
        ? this.ensureCategory({ name: translateValue(sub) ?? sub, nameRu: sub, parentId: group._id })
        : this.otherLeaf(group);
    }
    const groupId = leaf.parentId ?? group._id;
    return { id: leaf._id, groupId, name: leaf.local?.name ?? leaf.name, illustration: leaf.local?.illustration ?? leaf.illustration };
  }

  resolveBrand(manufacturer: string | undefined, country: string | undefined): BrandRef {
    const raw = manufacturer?.trim();
    const name = raw ? (translateValue(raw) ?? raw) : "Інші виробники";
    const id = slugify(name) || "inshi-vyrobnyky";
    let doc = this.brands.get(id);
    const countryUk = translateValue(country) ?? "";
    if (!doc) {
      doc = {
        _id: id,
        slug: id,
        name,
        country: countryUk,
        description: countryUk ? `${name} — виробник автоаксесуарів та тюнінгу (${countryUk}).` : `${name} — виробник автоаксесуарів та тюнінгу.`,
        productCount: 0,
        hidden: false,
        updatedAt: this.now,
      };
      this.brands.set(id, doc);
      this.dirtyBrands.add(id);
    } else if (!doc.country && countryUk) {
      doc.country = countryUk;
      doc.updatedAt = this.now;
      this.dirtyBrands.add(id);
    }
    return { id, name: doc.local?.name ?? doc.name };
  }

  resolveVehicle(parsed: ParsedModel): VehicleRef {
    if (parsed.universal) return { universal: true, fitment: [] };
    const makeId = makeSlugOf(parsed.makeName);
    let make = this.makes.get(makeId);
    if (!make) {
      make = { _id: makeId, slug: makeId, name: parsed.makeName, country: "", productCount: 0, updatedAt: this.now };
      this.makes.set(makeId, make);
      this.dirtyMakes.add(makeId);
    }
    const modelSlug = modelSlugOf(parsed);
    const modelId = `${makeId}-${modelSlug}`;
    let model = this.models.get(modelId);
    const supplierName = `${parsed.makeName} ${parsed.modelName}`.trim();
    if (!model) {
      model = {
        _id: modelId,
        slug: modelSlug,
        makeId,
        name: parsed.modelName,
        yearFrom: parsed.yearFrom ?? 0,
        yearTo: parsed.yearTo,
        body: "",
        productCount: 0,
        supplierNames: [supplierName],
        updatedAt: this.now,
      };
      this.models.set(modelId, model);
      this.dirtyModels.add(modelId);
    } else if (!model.supplierNames.includes(supplierName)) {
      model.supplierNames.push(supplierName);
      model.updatedAt = this.now;
      this.dirtyModels.add(modelId);
    }
    const years = parsed.yearFrom ? `${parsed.yearFrom}–${parsed.yearTo ?? "дотепер"}` : "";
    return {
      universal: false,
      fitment: [{ makeId, modelId, years }],
      markName: parsed.makeName,
      modelName: parsed.modelName,
    };
  }

  async flush(db: Db): Promise<void> {
    const c = cols(db);
    const write = async <T extends { _id: string }>(collection: { bulkWrite: (ops: AnyBulkWriteOperation<T>[], o?: { ordered: boolean }) => Promise<unknown> }, docs: T[]) => {
      for (let i = 0; i < docs.length; i += 500) {
        const chunk = docs.slice(i, i + 500);
        await collection.bulkWrite(
          chunk.map((doc) => {
            const { _id, ...rest } = doc;
            return { replaceOne: { filter: { _id } as never, replacement: rest as never, upsert: true } };
          }),
          { ordered: false },
        );
      }
    };
    await write(c.categories, [...this.dirtyCategories].map((id) => this.categories.get(id)!).filter(Boolean));
    await write(c.brands, [...this.dirtyBrands].map((id) => this.brands.get(id)!).filter(Boolean));
    await write(c.makes, [...this.dirtyMakes].map((id) => this.makes.get(id)!).filter(Boolean));
    await write(c.models, [...this.dirtyModels].map((id) => this.models.get(id)!).filter(Boolean));
    this.dirtyCategories.clear();
    this.dirtyBrands.clear();
    this.dirtyMakes.clear();
    this.dirtyModels.clear();
    invalidateTaxonomy();
  }
}

// ── run bookkeeping ─────────────────────────────────────────

async function saveRun(db: Db, run: SyncRunDoc): Promise<void> {
  run.updatedAt = nowIso();
  const { _id, ...rest } = run;
  await cols(db).syncRuns.replaceOne({ _id }, rest, { upsert: true });
}

function logTo(run: SyncRunDoc, options: SyncOptions, text: string): void {
  run.log.push({ at: nowIso(), text });
  if (run.log.length > LOG_LIMIT) run.log.splice(0, run.log.length - LOG_LIMIT);
  options.log?.(text);
  console.info(`[DD sync] ${text}`);
}

export async function getActiveRun(db: Db): Promise<SyncRunDoc | null> {
  return cols(db).syncRuns.findOne({ supplier: DD_SUPPLIER_CODE, status: { $in: ["running", "paused"] } }, { sort: { startedAt: -1 } });
}

export async function listSyncRuns(db: Db, limit = 10): Promise<SyncRunDoc[]> {
  return cols(db).syncRuns.find({ supplier: DD_SUPPLIER_CODE }).sort({ startedAt: -1 }).limit(limit).toArray();
}

export async function cancelSync(db: Db): Promise<boolean> {
  const result = await cols(db).syncRuns.updateMany(
    { supplier: DD_SUPPLIER_CODE, status: { $in: ["running", "paused"] } },
    { $set: { status: "cancelled", finishedAt: nowIso(), updatedAt: nowIso() } },
  );
  return result.modifiedCount > 0;
}

async function ensureSupplierDoc(db: Db): Promise<string> {
  const existing = await getSupplierByCode(db, DD_SUPPLIER_CODE);
  if (existing) return existing.id;
  const created = await createSupplier(
    db,
    {
      code: DD_SUPPLIER_CODE,
      name: "DD Tuning (ddtuning.com.ua)",
      active: true,
      contacts: { site: "https://ddtuning.com.ua", email: "", phone: "" },
      leadDays: [1, 3],
      paymentTerms: "Дропшипінг: оплата за оптовою ціною з особистого кабінету",
      deliveryTerms: "Відправка Новою Поштою напряму покупцю",
      shipsDirect: true,
      notes: "Каталог і ціни синхронізуються автоматично через API постачальника.",
    },
    { id: "sup-ddt" },
  );
  return created.id;
}

// ── the run ─────────────────────────────────────────────────

export async function runDdTuningSync(db: Db, options: SyncOptions = {}): Promise<SyncRunDoc> {
  const startedClock = Date.now();
  const budget = options.budgetMs ?? Number.POSITIVE_INFINITY;
  const overBudget = () => Date.now() - startedClock > budget;

  let run = options.runId ? await cols(db).syncRuns.findOne({ _id: options.runId }) : await getActiveRun(db);
  if (run && run.status === "cancelled") run = null;
  // Another worker is still on this run (it saves progress after every page): do not race it
  if (run && run.status === "running" && Date.now() - Date.parse(run.updatedAt) < 90_000) {
    options.log?.("Синхронізація вже виконується в іншому процесі");
    return run;
  }
  if (!run) {
    const now = nowIso();
    run = {
      _id: newId(),
      supplier: DD_SUPPLIER_CODE,
      status: "running",
      phase: "rates",
      offset: 0,
      startedAt: now,
      updatedAt: now,
      rates: { EUR: 0, USD: 0, source: "nbu" },
      counters: {},
      log: [],
    };
    logTo(run, options, "Синхронізацію розпочато");
  } else {
    // The staging copy may have been dropped meanwhile (e.g. to free space): the phases that read
    // it would then "finish" with nothing, so fail this run and let the next one start over.
    if (
      (run.phase === "wholesale" || run.phase === "build") &&
      (await cols(db).staging.countDocuments({ runId: run._id }, { limit: 1 })) === 0
    ) {
      run.status = "failed";
      run.error = "Тимчасові дані синхронізації зникли (базу очищено) — запустіть синхронізацію заново.";
      run.finishedAt = nowIso();
      logTo(run, options, run.error);
      await saveRun(db, run);
      return run;
    }
    run.status = "running";
    logTo(run, options, `Продовжуємо з фази «${run.phase}», позиція ${run.offset}`);
  }
  await saveRun(db, run);

  const settings = await getSettings(db);
  const policy: PricingPolicy = {
    priceSource: settings.supplier.priceSource,
    markupPercent: settings.supplier.markupPercent,
    roundTo: settings.supplier.roundTo,
  };
  const firstSyncAt = ((await cols(db).meta.findOne({ _id: "catalog.firstSyncAt" }))?.value as string | undefined) ?? undefined;
  const supplierId = await ensureSupplierDoc(db);
  const registry = new TaxonomyRegistry(run.startedAt);
  let registryLoaded = false;
  const ensureRegistry = async () => {
    if (!registryLoaded) {
      await registry.load(db);
      registryLoaded = true;
    }
  };

  try {
    while (run.phase !== "done") {
      if (overBudget()) {
        run.status = "paused";
        logTo(run, options, `Пауза (ліміт часу) на фазі «${run.phase}», позиція ${run.offset}`);
        await saveRun(db, run);
        return run;
      }

      switch (run.phase) {
        case "rates": {
          if (settings.supplier.rates.source === "manual" && settings.supplier.rates.EUR > 0 && settings.supplier.rates.USD > 0) {
            run.rates = { EUR: settings.supplier.rates.EUR, USD: settings.supplier.rates.USD, source: "manual" };
          } else {
            try {
              const rates = await fetchNbuRates();
              run.rates = { ...rates, source: "nbu" };
              await saveSettings(db, { supplier: { ...settings.supplier, rates: { ...rates, source: "nbu", updatedAt: nowIso() } } });
            } catch (error) {
              const fallback = settings.supplier.rates;
              if (!(fallback.EUR > 0 && fallback.USD > 0)) throw new SyncError(`Не вдалося отримати курси НБУ: ${error instanceof Error ? error.message : error}`);
              run.rates = { EUR: fallback.EUR, USD: fallback.USD, source: fallback.source };
              logTo(run, options, "НБУ недоступний — використано збережені курси");
            }
          }
          logTo(run, options, `Курси: EUR ${run.rates.EUR}, USD ${run.rates.USD} (${run.rates.source})`);
          run.phase = nextPhase(run.phase);
          run.offset = 0;
          break;
        }

        case "categories": {
          await ensureRegistry();
          const raw = await fetchCategories("ua");
          registry.applyApiCategories(raw);
          await registry.flush(db);
          run.counters.categories = registry.categories.size;
          logTo(run, options, `Категорії: ${registry.categories.size}`);
          run.phase = nextPhase(run.phase);
          run.offset = 0;
          break;
        }

        case "retail": {
          // Leftovers of earlier failed runs would otherwise pile up (the staging copy is per run anyway)
          if (run.offset === 0) await cols(db).staging.deleteMany({});
          await assertStorageHeadroom(db, run.offset === 0 ? SYNC_MIN_FREE_MB : SYNC_PAGE_MIN_FREE_MB);
          const page = await fetchPricePage("retail", run.offset, DD_PAGE_SIZE, "ua");
          const docs: StagingDoc[] = page.data
            .filter((raw) => raw && typeof raw.id === "number" && raw.title)
            .map((raw) => ({
              _id: raw.id,
              runId: run!._id,
              parentId: raw.parent ? Number(raw.parent.id) || null : null,
              parentTitle: raw.parent?.title,
              mark: String(raw.mark ?? ""),
              model: String(raw.model ?? ""),
              category: String(raw.category ?? ""),
              subcategory: String(raw.subcategory ?? ""),
              item: toSupplierItem(raw),
            }));
          if (docs.length) {
            await cols(db).staging.bulkWrite(
              docs.map((doc) => {
                const { _id, ...rest } = doc;
                return { replaceOne: { filter: { _id }, replacement: rest, upsert: true } };
              }),
              { ordered: false },
            );
          }
          run.counters.retailItems = (run.counters.retailItems ?? 0) + docs.length;
          run.counters.totalResults = page.totalResults;
          logTo(run, options, `Роздріб: ${run.counters.retailItems} / ${page.totalResults}`);
          run.offset += page.data.length;
          if (page.data.length < DD_PAGE_SIZE || run.offset >= page.totalResults) {
            run.phase = nextPhase(run.phase);
            run.offset = 0;
          }
          break;
        }

        case "wholesale": {
          const page = await fetchPricePage("wholesale", run.offset, DD_PAGE_SIZE, "ua");
          const rowsById = new Map<number, RawCost[]>();
          for (const raw of page.data) {
            if (!raw || typeof raw.id !== "number") continue;
            const list = rowsById.get(raw.id) ?? [];
            list.push({ price: Number(raw.price) || 0, currency: String(raw.currency ?? ""), quantity: Number(raw.quantity ?? raw.available_in_stock ?? 0) || 0 });
            rowsById.set(raw.id, list);
          }
          const ops: AnyBulkWriteOperation<StagingDoc>[] = [];
          for (const [id, rows] of rowsById) {
            const best = pickBestCost(rows, run.rates);
            if (!best) continue;
            const currency = (best.currency || "UAH").toUpperCase();
            ops.push({
              updateOne: {
                filter: { _id: id, runId: run._id },
                update: { $set: { "item.cost": { amount: Math.round(best.price * 100) / 100, currency: currency === "EUR" || currency === "USD" ? currency : "UAH" } } },
              },
            });
          }
          if (ops.length) await cols(db).staging.bulkWrite(ops, { ordered: false });
          run.counters.wholesaleRows = (run.counters.wholesaleRows ?? 0) + page.data.length;
          run.counters.costed = (run.counters.costed ?? 0) + ops.length;
          logTo(run, options, `Опт: ${run.counters.wholesaleRows} рядків, собівартість для ${run.counters.costed}`);
          run.offset += page.data.length;
          if (page.data.length < DD_PAGE_SIZE || run.offset >= page.totalResults) {
            run.phase = nextPhase(run.phase);
            run.offset = 0;
          }
          break;
        }

        case "build": {
          await ensureRegistry();
          const ctx: BuildContext = {
            rates: run.rates,
            policy,
            now: run.startedAt,
            firstSyncAt,
            resolveCategory: (c, s) => registry.resolveCategory(c, s),
            resolveBrand: (m, c) => registry.resolveBrand(m, c),
            resolveVehicle: (p) => registry.resolveVehicle(p),
          };
          const built = await buildAllProducts(db, run, ctx, registry, async () => {
            if (overBudget()) return false;
            return true;
          });
          await registry.flush(db);
          run.counters.products = built.products;
          run.counters.groups = built.groups;
          if (!built.complete) {
            run.status = "paused";
            logTo(run, options, `Пауза після ${built.products} товарів (ліміт часу)`);
            await saveRun(db, run);
            return run;
          }
          logTo(run, options, `Товари: ${built.products} (з них груп з варіантами: ${built.groups})`);
          run.phase = nextPhase(run.phase);
          run.offset = 0;
          break;
        }

        case "taxonomy": {
          await ensureRegistry();
          await registry.flush(db);
          await markPopularMakesAndBrands(db);
          await recountTaxonomy(db);
          run.counters.brands = await cols(db).brands.countDocuments();
          run.counters.makes = await cols(db).makes.countDocuments();
          run.counters.models = await cols(db).models.countDocuments();
          logTo(run, options, `Бренди: ${run.counters.brands}, марки: ${run.counters.makes}, моделі: ${run.counters.models}`);
          run.phase = nextPhase(run.phase);
          run.offset = 0;
          break;
        }

        case "offers": {
          const written = await syncOffers(db, run, supplierId, overBudget);
          run.counters.offers = (run.counters.offers ?? 0) + written.count;
          if (!written.complete) {
            run.status = "paused";
            await saveRun(db, run);
            return run;
          }
          logTo(run, options, `Прайс-лист постачальника: ${run.counters.offers} позицій`);
          run.phase = nextPhase(run.phase);
          run.offset = 0;
          break;
        }

        case "finalize": {
          // A run that built nothing (empty staging, aborted import) must not hide the whole catalog
          let retiredCount = 0;
          if ((run.counters.products ?? 0) > 0) {
            const retired = await cols(db).products.updateMany(
              { source: "ddtuning", "supplier.syncedAt": { $lt: run.startedAt } },
              { $set: { hidden: true, retired: true, stock: "out_of_stock", stockRank: 3, updatedAt: nowIso() } },
            );
            retiredCount = retired.modifiedCount;
          } else {
            logTo(run, options, "Товари не оновлювались — нічого не знімаємо з продажу");
          }
          run.counters.retired = retiredCount;
          await cols(db).staging.deleteMany({ runId: run._id });
          await recountTaxonomy(db);
          // categories the sync created earlier that ended up empty (not the supplier's own, not edited by the admin)
          const emptyAuto = await cols(db).categories.deleteMany({
            supplierIds: { $size: 0 },
            productCount: 0,
            local: { $exists: false },
            $or: [{ name: "" }, { name: "Інше" }, { nameRu: { $exists: true } }],
          });
          run.counters.cleanedCategories = emptyAuto.deletedCount;
          invalidateTaxonomy();
          if (!firstSyncAt) await cols(db).meta.updateOne({ _id: "catalog.firstSyncAt" }, { $set: { value: run.startedAt } }, { upsert: true });
          await cols(db).meta.updateOne({ _id: "catalog.lastSyncAt" }, { $set: { value: nowIso() } }, { upsert: true });
          logTo(run, options, `Завершено. Знято з продажу: ${retiredCount}`);
          run.phase = "done";
          run.status = "done";
          run.finishedAt = nowIso();
          break;
        }

        default:
          run.phase = "done";
      }
      await saveRun(db, run);
    }
    await revalidateStorefront();
    return run;
  } catch (error) {
    run.status = "failed";
    run.error = error instanceof Error ? error.message : String(error);
    run.finishedAt = nowIso();
    logTo(run, options, `Помилка: ${run.error}`);
    await saveRun(db, run);
    return run;
  }
}

// ── build phase ─────────────────────────────────────────────

interface BuildStats {
  products: number;
  groups: number;
  complete: boolean;
}

async function buildAllProducts(db: Db, run: SyncRunDoc, ctx: BuildContext, registry: TaxonomyRegistry, mayContinue: () => Promise<boolean>): Promise<BuildStats> {
  const staging = cols(db).staging;
  const stats: BuildStats = { products: run.counters.products ?? 0, groups: run.counters.groups ?? 0, complete: false };
  if (run.offset === 0) {
    stats.products = 0;
    stats.groups = 0;
  }

  // 1. variant groups (parentId != null), grouped in the database; 2. standalone items
  const flush = async (groups: StagingDoc[][]) => {
    if (groups.length === 0) return;
    const inputs = groups.map((docs) => ({
      items: docs.map((d) => d.item),
      parentId: docs[0].parentId,
      parentTitle: docs[0].parentTitle,
      mark: docs[0].mark,
      model: docs[0].model,
      category: docs[0].category,
      subcategory: docs[0].subcategory,
    }));
    const ids = inputs.map(productIdFor);
    const existing = await existingProductMeta(db, ids);
    const productDocs: ProductDoc[] = inputs.map((input) => {
      const prev = existing.get(productIdFor(input));
      const built = buildProduct(input, ctx, prev?.createdAt);
      const effective: Product = applyLocalOverrides(built.product, prev?.local);
      denormalizeTaxonomy(effective, registry);
      if (prev) {
        effective.rating = prev.rating ?? 0;
        effective.reviewsCount = prev.reviewsCount ?? 0;
      }
      const doc = productToDoc(effective, {
        source: "ddtuning",
        hidden: prev?.hidden && !prev.retired ? true : false,
        skus: built.skus,
        supplier: built.supplier,
        local: prev?.local,
        updatedAt: ctx.now,
      });
      return doc;
    });
    await writeProductDocs(db, productDocs);
    stats.products += productDocs.length;
    stats.groups += inputs.filter((i) => i.items.length > 1 && i.parentId).length;
  };

  // phase offset: 0 = groups not done yet; 1 = groups done, standalone pending (we re-run cheaply)
  if (run.offset === 0) {
    const cursor = staging.aggregate<{ _id: number; docs: StagingDoc[] }>(
      [{ $match: { runId: run._id, parentId: { $ne: null } } }, { $group: { _id: "$parentId", docs: { $push: "$$ROOT" } } }],
      { allowDiskUse: true },
    );
    let batch: StagingDoc[][] = [];
    for await (const group of cursor) {
      batch.push(group.docs);
      if (batch.length >= BUILD_BATCH) {
        await flush(batch);
        batch = [];
        if (!(await mayContinue())) {
          await cursor.close();
          run.counters.products = stats.products;
          run.counters.groups = stats.groups;
          return stats;
        }
      }
    }
    await flush(batch);
    run.offset = 1;
    run.counters.products = stats.products;
    run.counters.groups = stats.groups;
    await saveRun(db, run);
  }

  const singles = staging.find({ runId: run._id, parentId: null }).sort({ _id: 1 });
  let batch: StagingDoc[][] = [];
  for await (const doc of singles) {
    batch.push([doc]);
    if (batch.length >= BUILD_BATCH) {
      await flush(batch);
      batch = [];
      if (!(await mayContinue())) {
        await singles.close();
        run.counters.products = stats.products;
        return stats;
      }
    }
  }
  await flush(batch);
  stats.complete = true;
  return stats;
}

// ── offers phase ────────────────────────────────────────────

async function syncOffers(db: Db, run: SyncRunDoc, supplierId: string, overBudget: () => boolean): Promise<{ count: number; complete: boolean }> {
  const cursor = cols(db)
    .products.find(
      { source: "ddtuning", "supplier.syncedAt": run.startedAt },
      { projection: { _id: 1, supplier: 1, option: 1 }, sort: { _id: 1 }, skip: run.offset },
    );
  let rows: OfferInput[] = [];
  let stale: string[] = [];
  let count = 0;
  let processed = 0;
  const flush = async () => {
    if (stale.length) {
      await deleteOffersBySku(db, supplierId, stale);
      stale = [];
    }
    if (!rows.length) return;
    await upsertOffers(db, supplierId, rows);
    count += rows.length;
    rows = [];
  };
  for await (const doc of cursor) {
    processed++;
    for (const item of doc.supplier?.items ?? []) {
      const cost = item.cost ? Math.round(toUahSafe(item.cost.amount, item.cost.currency, run.rates)) : 0;
      if (!cost) {
        // not in the wholesale list any more (or only with a token price): its offer must not survive
        stale.push(`DD-${item.id}`);
        continue;
      }
      rows.push({
        sku: `DD-${item.id}`,
        productId: doc._id,
        cost,
        availability: item.qty > 0 ? "in_stock" : /в дорозі|уточн/i.test(item.warehouse ?? "") ? "on_order" : "none",
        qty: item.qty,
        leadDays: [1, 3],
      });
    }
    if (rows.length >= OFFER_BATCH || stale.length >= OFFER_BATCH) {
      await flush();
      if (overBudget()) {
        await cursor.close();
        run.offset += processed;
        return { count, complete: false };
      }
    }
  }
  await flush();
  return { count, complete: true };
}

function toUahSafe(amount: number, currency: "EUR" | "USD" | "UAH", rates: Rates): number {
  if (currency === "EUR") return amount * rates.EUR;
  if (currency === "USD") return amount * rates.USD;
  return amount;
}

// ── taxonomy helpers ────────────────────────────────────────

/** The 12 makes and 12 brands with most products are "popular" (home page tiles) */
async function markPopularMakesAndBrands(db: Db): Promise<void> {
  const c = cols(db);
  const topMakes = await c.products
    .aggregate<{ _id: string; n: number }>([{ $match: { hidden: false } }, { $unwind: "$fitment" }, { $group: { _id: "$fitment.makeId", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 12 }])
    .toArray();
  await c.makes.updateMany({}, { $set: { popular: false } });
  if (topMakes.length) await c.makes.updateMany({ _id: { $in: topMakes.map((m) => m._id) } }, { $set: { popular: true } });

  const topBrands = await c.products
    .aggregate<{ _id: string; n: number }>([{ $match: { hidden: false } }, { $group: { _id: "$brandId", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 12 }])
    .toArray();
  await c.brands.updateMany({ "local.popular": { $exists: false } }, { $set: { popular: false } });
  if (topBrands.length) await c.brands.updateMany({ _id: { $in: topBrands.map((b) => b._id) }, "local.popular": { $exists: false } }, { $set: { popular: true } });
}

async function revalidateStorefront(): Promise<void> {
  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/", "layout");
  } catch {
    // outside a Next.js request scope (tests, scripts) there is nothing to revalidate
  }
}

// ── rebuilding products outside a sync (admin edits, pricing changes) ──

interface Rebuilder {
  rebuild: (doc: ProductDoc, options: { keepLocal: boolean }) => ProductDoc | null;
  flush: () => Promise<void>;
}

/**
 * A local override can move a product to a different category or brand than the supplier's. The
 * denormalized group / names / illustration must follow the EFFECTIVE id, otherwise the product is
 * grouped and labelled under the old category/brand and the leaf and group taxonomy counts diverge.
 * Re-derives them from the registry after the overrides have been applied.
 */
function denormalizeTaxonomy(product: Product, registry: TaxonomyRegistry): void {
  const category = registry.categories.get(product.categoryId);
  if (category) {
    product.categoryName = category.local?.name ?? category.name;
    product.illustration = category.local?.illustration ?? category.illustration;
    product.groupId = category.parentId ?? category._id;
  }
  const brand = registry.brands.get(product.brandId);
  if (brand) product.brandName = brand.local?.name ?? brand.name;
}

/**
 * Prepares a rebuilder that recomputes the effective product of supplier documents from their
 * stored items with the current settings. The stored category / vehicle references are kept,
 * so the result is stable without calling the API.
 */
async function createRebuilder(db: Db): Promise<Rebuilder> {
  const settings = await getSettings(db);
  const registry = new TaxonomyRegistry(nowIso());
  await registry.load(db);
  const rates: Rates = { EUR: settings.supplier.rates.EUR, USD: settings.supplier.rates.USD };
  const now = nowIso();
  const ctx: BuildContext = {
    rates,
    policy: { priceSource: settings.supplier.priceSource, markupPercent: settings.supplier.markupPercent, roundTo: settings.supplier.roundTo },
    now,
    resolveCategory: (c, s) => registry.resolveCategory(c, s),
    resolveBrand: (m, c) => registry.resolveBrand(m, c),
    resolveVehicle: (p) => registry.resolveVehicle(p),
  };
  return {
    rebuild(doc, options) {
      if (!doc.supplier || doc.source !== "ddtuning" || doc.supplier.items.length === 0) return null;
      const category = registry.categories.get(doc.categoryId);
      const group = category?.parentId ? registry.categories.get(category.parentId) : undefined;
      const make = doc.fitment[0] ? registry.makes.get(doc.fitment[0].makeId) : undefined;
      const model = doc.fitment[0] ? registry.models.get(doc.fitment[0].modelId) : undefined;
      const isGroup = doc.supplier.items.length > 1 && Boolean(doc.supplier.groupId);
      const input: Parameters<typeof buildProduct>[0] = {
        items: doc.supplier.items,
        parentId: doc.supplier.groupId ?? null,
        // for groups the parent title is the stored name without the vehicle suffix
        parentTitle: isGroup ? stripVehicleSuffix(doc.name, make?.name, model?.name) : undefined,
        mark: make?.name ?? "Универсальные",
        model: model
          ? `${make?.name ?? ""} ${model.name === "Усі моделі" ? "" : model.name} ${model.yearFrom ? `${model.yearFrom}-${model.yearTo ?? ""}` : ""}`.replace(/\s+/g, " ").trim()
          : "Универсальные",
        category: group?.nameRu ?? group?.name ?? category?.nameRu ?? category?.name ?? "",
        subcategory: category?.nameRu ?? category?.name ?? "",
      };
      const built = buildProduct(input, ctx, doc.createdAt);
      const effective = applyLocalOverrides(built.product, options.keepLocal ? doc.local : undefined);
      denormalizeTaxonomy(effective, registry);
      effective.rating = doc.rating;
      effective.reviewsCount = doc.reviewsCount;
      effective.slug = doc.local?.slug ?? doc.slug;
      const next = productToDoc(effective, {
        source: "ddtuning",
        hidden: doc.hidden,
        retired: doc.retired,
        skus: built.skus,
        supplier: { ...built.supplier, syncedAt: doc.supplier.syncedAt },
        local: options.keepLocal && doc.local && Object.keys(doc.local).length ? doc.local : undefined,
        updatedAt: now,
      });
      next.createdAt = doc.createdAt;
      return next;
    },
    flush: () => registry.flush(db),
  };
}

function stripVehicleSuffix(name: string, makeName?: string, modelName?: string): string {
  let out = name;
  if (modelName && modelName !== "Усі моделі" && out.endsWith(` ${modelName}`)) out = out.slice(0, -modelName.length - 1);
  if (makeName && out.endsWith(` ${makeName}`)) out = out.slice(0, -makeName.length - 1);
  return out.trim() || name;
}

/** Rebuilds one supplier product (admin "reset to supplier data" when keepLocal is false) */
export async function rebuildProductFromSupplier(db: Db, doc: ProductDoc, options: { keepLocal: boolean }): Promise<ProductDoc | null> {
  const rebuilder = await createRebuilder(db);
  const next = rebuilder.rebuild(doc, options);
  if (!next) return null;
  await writeProductDocs(db, [next]);
  await rebuilder.flush();
  return next;
}

/** Admin edit of a supplier product: stores the override and recomputes the effective product */
export async function applyLocalPatch(db: Db, id: string, patch: Partial<NonNullable<ProductDoc["local"]>> | null): Promise<ProductDoc | null> {
  const doc = await cols(db).products.findOne({ _id: id });
  if (!doc) return null;
  const local = patch === null ? undefined : { ...(doc.local ?? {}), ...patch };
  if (local) for (const key of Object.keys(local) as (keyof NonNullable<ProductDoc["local"]>)[]) if (local[key] === undefined) delete local[key];
  const withLocal: ProductDoc = { ...doc, local: local && Object.keys(local).length ? local : undefined };
  if (!withLocal.local) delete withLocal.local;
  return rebuildProductFromSupplier(db, withLocal, { keepLocal: true });
}

/** Recomputes every supplier product with the current pricing policy and rates (batched, resumable by offset) */
export async function rebuildAllFromSupplier(db: Db, options: { budgetMs?: number; offset?: number } = {}): Promise<{ processed: number; complete: boolean; offset: number }> {
  const started = Date.now();
  const budget = options.budgetMs ?? Number.POSITIVE_INFINITY;
  const rebuilder = await createRebuilder(db);
  let offset = options.offset ?? 0;
  let processed = 0;
  for (;;) {
    const docs = await cols(db).products.find({ source: "ddtuning" }, { sort: { _id: 1 }, skip: offset, limit: 500 }).toArray();
    if (docs.length === 0) break;
    const next = docs.map((doc) => rebuilder.rebuild(doc, { keepLocal: true })).filter((d): d is ProductDoc => Boolean(d));
    await writeProductDocs(db, next);
    offset += docs.length;
    processed += next.length;
    if (Date.now() - started > budget) {
      await rebuilder.flush();
      return { processed, complete: false, offset };
    }
  }
  await rebuilder.flush();
  await recountTaxonomy(db);
  await revalidateStorefront();
  return { processed, complete: true, offset };
}

export { toSupplierItem, type RawItem, type SupplierItem };
