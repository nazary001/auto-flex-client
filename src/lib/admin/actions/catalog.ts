"use server";

import type { Db } from "mongodb";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Product, ProductFitment } from "@/lib/types";
import { slugify } from "@/lib/slug";
import { parseCsv, parseNumber } from "@/lib/admin/domain/csv";
import { cols, type CategoryDoc, type ProductDoc, type ProductLocal } from "@/lib/server/db/collections";
import { docToProduct } from "@/lib/server/catalog/product-doc";
import {
  deleteProduct,
  getProductDoc,
  recountTaxonomy,
  saveProduct,
  setProductHidden,
  setProductsHidden,
} from "@/lib/server/catalog/products";
import { applyLocalPatch, rebuildProductFromSupplier } from "@/lib/server/suppliers/ddtuning/sync";
import { getTaxonomy, invalidateTaxonomy } from "@/lib/server/catalog/taxonomy-cache";
import { newId, nowIso } from "@/lib/server/db/util";
import { getModelsForMake, slugTaken } from "@/lib/admin/queries/catalog";
import { ActionError, fail, runAction, type ActionResult } from "./_action";

/*
 * Catalog mutations (permission catalog:write). The catalog lives in MongoDB. Supplier products
 * (source "ddtuning") are edited through `applyLocalPatch`, which stores only the changed fields
 * in `local` and recomputes the effective product from the supplier data, so a later sync keeps
 * the edits. Manual / demo products are written whole with `saveProduct`. Every write audits the
 * change, refreshes taxonomy counts where membership changed and revalidates the storefront.
 */

const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

const stockEnum = z.enum(["in_stock", "low_stock", "preorder", "out_of_stock"]);
const badgeEnum = z.enum(["new", "sale", "hit"]);

async function afterCatalogWrite(db: Db, paths: string[], recount: boolean): Promise<void> {
  if (recount) await recountTaxonomy(db);
  else invalidateTaxonomy();
  revalidatePath("/", "layout");
  for (const path of paths) revalidatePath(path);
}

function hasLocal(doc: Pick<ProductDoc, "local">): boolean {
  return Boolean(doc.local && Object.keys(doc.local).length > 0);
}

// ── product editor ──────────────────────────────────────────

const productInputSchema = z.object({
  id: z.string().trim().max(80).optional(),
  name: z.string().trim().min(2, "Вкажіть назву товару.").max(200),
  slug: z.string().trim().max(200).optional(),
  sku: z.string().trim().min(1, "Вкажіть артикул.").max(80),
  oemNumbers: z.array(z.string().trim().max(80)).max(40).default([]),
  brandId: z.string().min(1, "Оберіть бренд."),
  categoryId: z.string().min(1, "Оберіть категорію."),
  price: z.coerce.number().int("Ціна має бути цілим числом.").min(0, "Ціна не може бути відʼємною.").max(100_000_000),
  oldPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
  stock: stockEnum,
  deliveryMin: z.coerce.number().int().min(0).max(365).default(1),
  deliveryMax: z.coerce.number().int().min(0).max(365).default(3),
  images: z.array(z.string().trim().max(500)).max(12).default([]),
  badges: z.array(badgeEnum).max(3).default([]),
  shortDescription: z.string().trim().max(400).default(""),
  description: z.array(z.string().trim().max(4000)).max(40).default([]),
  specs: z.array(z.object({ name: z.string().trim().max(120), value: z.string().trim().max(400) })).max(60).default([]),
  fitment: z
    .array(
      z.object({
        makeId: z.string().trim().max(80),
        modelId: z.string().trim().max(80),
        years: z.string().trim().max(40).default(""),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .max(80)
    .default([]),
  universal: z.boolean().default(false),
  option: z
    .object({
      id: z.string().trim().min(1).max(80),
      name: z.string().trim().min(1).max(80),
      values: z
        .array(
          z.object({
            id: z.string().trim().min(1).max(60),
            label: z.string().trim().min(1).max(80),
            priceDelta: z.coerce.number().int().min(-1_000_000).max(1_000_000).default(0),
          }),
        )
        .max(30)
        .default([]),
    })
    .optional(),
  warrantyMonths: z.coerce.number().int().min(0).max(240).default(12),
  popularity: z.coerce.number().int().min(0).max(100000).default(1000),
  createdAt: z.string().trim().max(40).optional(),
});

type ProductInput = z.infer<typeof productInputSchema>;

function cleanFitment(data: ProductInput): ProductFitment[] {
  if (data.universal) return [];
  return data.fitment
    .filter((f) => f.makeId && f.modelId)
    .map((f) => ({ makeId: f.makeId, modelId: f.modelId, years: f.years, ...(f.note ? { note: f.note } : {}) }));
}

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Fields of a supplier product that differ from its current effective value, as a `local` patch. */
function supplierPatch(current: Product, data: ProductInput, slug: string, deliveryDays: [number, number]): ProductLocal {
  const patch: ProductLocal = {};
  if (data.name !== current.name) patch.name = data.name;
  if (slug !== current.slug) patch.slug = slug;
  if (data.price !== current.price) patch.price = data.price;

  const submittedOld = data.oldPrice && data.oldPrice > 0 ? data.oldPrice : undefined;
  if (submittedOld !== current.oldPrice) patch.oldPrice = submittedOld ?? null;

  if (data.stock !== current.stock) patch.stock = data.stock;
  if (data.shortDescription !== current.shortDescription) patch.shortDescription = data.shortDescription;

  const description = data.description.map((p) => p.trim()).filter(Boolean);
  if (!sameJson(description, current.description)) patch.description = description;

  const specs = data.specs.filter((s) => s.name.trim() || s.value.trim());
  if (!sameJson(specs, current.specs)) patch.specs = specs;

  const images = data.images.map((v) => v.trim()).filter(Boolean);
  if (!sameJson(images, current.images)) patch.images = images;

  if (!sameJson(data.badges, current.badges)) patch.badges = data.badges;
  if (data.categoryId !== current.categoryId) patch.categoryId = data.categoryId;
  if (data.brandId !== current.brandId) patch.brandId = data.brandId;
  if (!sameJson(deliveryDays, current.deliveryDays)) patch.deliveryDays = deliveryDays;
  if (data.warrantyMonths !== current.warrantyMonths) patch.warrantyMonths = data.warrantyMonths;
  if (data.popularity !== current.popularity) patch.popularity = data.popularity;

  const oemNumbers = data.oemNumbers.map((v) => v.trim()).filter(Boolean);
  if (!sameJson(oemNumbers, current.oemNumbers)) patch.oemNumbers = oemNumbers;

  const fitment = cleanFitment(data);
  if (!sameJson(fitment, current.fitment)) patch.fitment = fitment;
  if (data.universal !== current.universal) patch.universal = data.universal;

  return patch;
}

export async function saveProductAction(input: unknown): Promise<ActionResult<{ id: string; slug: string }>> {
  return runAction({
    permission: "catalog:write",
    schema: productInputSchema,
    input,
    run: async (data, ctx) => {
      const id = data.id?.trim() || `m-${newId()}`;
      const existing = data.id ? await getProductDoc(ctx.db, id) : null;
      const slug = (data.slug?.trim() || slugify(data.name) || `tovar-${id}`).slice(0, 200);
      if (await slugTaken(ctx.db, slug, id)) {
        throw new ActionError("Цей слаг уже зайнятий.", { slug: "Такий слаг уже використовується іншим товаром." });
      }
      if (data.oldPrice && data.oldPrice > 0 && data.oldPrice <= data.price) {
        throw new ActionError("Стара ціна має бути більшою за поточну.", { oldPrice: "Має бути більшою за ціну." });
      }
      const deliveryDays: [number, number] = [Math.min(data.deliveryMin, data.deliveryMax), Math.max(data.deliveryMin, data.deliveryMax)];

      if (existing && existing.source === "ddtuning") {
        const patch = supplierPatch(docToProduct(existing), data, slug, deliveryDays);
        if (Object.keys(patch).length > 0) await applyLocalPatch(ctx.db, id, patch);
        await ctx.audit({ action: "product.save", entity: "product", entityId: id, summary: `Товар «${data.name}» збережено (зміни постачальника)` });
        await afterCatalogWrite(ctx.db, ["/admin/products", `/admin/products/${id}`], Object.keys(patch).some((k) => k === "categoryId" || k === "brandId"));
        return { id, slug };
      }

      const tax = await getTaxonomy();
      const category = tax.categoryById.get(data.categoryId);
      const brand = tax.brandById.get(data.brandId);
      const product: Product = {
        id,
        slug,
        sku: data.sku,
        oemNumbers: data.oemNumbers.map((v) => v.trim()).filter(Boolean),
        name: data.name,
        brandId: data.brandId,
        categoryId: data.categoryId,
        price: data.price,
        ...(data.oldPrice && data.oldPrice > 0 ? { oldPrice: data.oldPrice } : {}),
        stock: data.stock,
        deliveryDays,
        images: data.images.map((v) => v.trim()).filter(Boolean),
        badges: data.badges,
        rating: existing?.rating ?? 0,
        reviewsCount: existing?.reviewsCount ?? 0,
        shortDescription: data.shortDescription,
        description: data.description.map((p) => p.trim()).filter(Boolean),
        specs: data.specs.filter((s) => s.name.trim() || s.value.trim()),
        fitment: cleanFitment(data),
        universal: data.universal,
        ...(data.option && data.option.values.length > 0 ? { option: data.option } : {}),
        warrantyMonths: data.warrantyMonths,
        createdAt: data.createdAt?.trim() || existing?.createdAt || nowIso(),
        popularity: data.popularity,
        brandName: brand?.name,
        categoryName: category?.name,
        illustration: category?.illustration,
        groupId: category ? category.parentId ?? category.id : undefined,
      };

      await saveProduct(ctx.db, product, { source: existing?.source ?? "manual", hidden: existing?.hidden });
      await ctx.audit({ action: "product.save", entity: "product", entityId: id, summary: `Товар «${product.name}» збережено` });
      await afterCatalogWrite(ctx.db, ["/admin/products", `/admin/products/${id}`], true);
      return { id, slug };
    },
  });
}

const fieldSchema = z.object({
  id: z.string().min(1),
  field: z.enum(["price", "oldPrice", "stock"]),
  value: z.union([z.string(), z.number()]),
});

export async function updateProductFieldAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "catalog:write",
    schema: fieldSchema,
    input,
    run: async ({ id, field, value }, ctx) => {
      const doc = await getProductDoc(ctx.db, id);
      if (!doc) throw new ActionError("Товар не знайдено.");

      let stock: Product["stock"] | undefined;
      let n = 0;
      if (field === "stock") {
        const parsed = stockEnum.safeParse(value);
        if (!parsed.success) throw new ActionError("Невідомий статус наявності.");
        stock = parsed.data;
      } else {
        n = Math.round(Number(value));
        if (!Number.isFinite(n) || n < 0) throw new ActionError("Вкажіть коректну суму.");
        if (field === "oldPrice" && n > 0 && n <= doc.price) throw new ActionError("Стара ціна має бути більшою за поточну.");
      }

      if (doc.source === "ddtuning") {
        const patch: ProductLocal = {};
        if (field === "stock") patch.stock = stock;
        else if (field === "price") patch.price = n;
        else patch.oldPrice = n > 0 ? n : null;
        await applyLocalPatch(ctx.db, id, patch);
      } else {
        const product = docToProduct(doc);
        if (field === "stock") product.stock = stock!;
        else if (field === "price") {
          product.price = n;
          if (product.oldPrice && product.oldPrice <= n) delete product.oldPrice;
        } else if (n > 0) product.oldPrice = n;
        else delete product.oldPrice;
        await saveProduct(ctx.db, product, {});
      }

      await ctx.audit({ action: "product.field", entity: "product", entityId: id, summary: `Товар «${doc.name}»: ${field}` });
      await afterCatalogWrite(ctx.db, ["/admin/products", `/admin/products/${id}`], false);
      return undefined;
    },
  });
}

export async function setProductHiddenAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "catalog:write",
    schema: z.object({ id: z.string().min(1), hidden: z.boolean() }),
    input,
    run: async ({ id, hidden }, ctx) => {
      const doc = await getProductDoc(ctx.db, id);
      if (!doc) throw new ActionError("Товар не знайдено.");
      await setProductHidden(ctx.db, id, hidden);
      await ctx.audit({
        action: "product.hidden",
        entity: "product",
        entityId: id,
        summary: hidden ? `Товар «${doc.name}» приховано` : `Товар «${doc.name}» показано`,
      });
      await afterCatalogWrite(ctx.db, ["/admin/products", `/admin/products/${id}`], true);
      return undefined;
    },
  });
}

/** Clears admin overrides on a supplier product and rebuilds it from the supplier data. */
export async function resetProductOverridesAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "catalog:write",
    schema: z.object({ id: z.string().min(1) }),
    input,
    run: async ({ id }, ctx) => {
      const doc = await getProductDoc(ctx.db, id);
      if (!doc) throw new ActionError("Товар не знайдено.");
      if (doc.source !== "ddtuning") throw new ActionError("Скинути зміни можна лише для товарів постачальника.");
      if (!hasLocal(doc)) throw new ActionError("Для цього товару немає змін.");
      await rebuildProductFromSupplier(ctx.db, doc, { keepLocal: false });
      await ctx.audit({ action: "product.reset", entity: "product", entityId: id, summary: `Зміни товару «${doc.name}» скинуто` });
      await afterCatalogWrite(ctx.db, ["/admin/products", `/admin/products/${id}`], true);
      return undefined;
    },
  });
}

/** Deletes a manual / demo product. Supplier products are retired by the sync, never deleted. */
export async function deleteProductAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "catalog:write",
    schema: z.object({ id: z.string().min(1) }),
    input,
    run: async ({ id }, ctx) => {
      const doc = await getProductDoc(ctx.db, id);
      if (!doc) throw new ActionError("Товар не знайдено.");
      if (doc.source === "ddtuning") throw new ActionError("Товар постачальника не можна видалити — приховайте його.");
      await deleteProduct(ctx.db, id);
      await ctx.audit({ action: "product.delete", entity: "product", entityId: id, summary: `Товар «${doc.name}» видалено` });
      await afterCatalogWrite(ctx.db, ["/admin/products"], true);
      return undefined;
    },
  });
}

// ── bulk ────────────────────────────────────────────────────

const idsSchema = z.array(z.string().min(1)).min(1, "Оберіть хоча б один товар.").max(500);

/** Reprices supplier products by a markup percent over the supplier price (clears any fixed price). */
export async function bulkMarkupAction(input: unknown): Promise<ActionResult<{ updated: number; skipped: number }>> {
  return runAction({
    permission: "catalog:write",
    schema: z.object({ ids: idsSchema, markupPercent: z.coerce.number().min(0).max(1000) }),
    input,
    run: async ({ ids, markupPercent }, ctx) => {
      let updated = 0;
      let skipped = 0;
      for (const id of ids) {
        const doc = await getProductDoc(ctx.db, id);
        if (!doc || doc.source !== "ddtuning") {
          skipped++;
          continue;
        }
        await applyLocalPatch(ctx.db, id, { markupPercent, price: undefined });
        updated++;
      }
      await ctx.audit({
        action: "product.bulk_markup",
        entity: "product",
        entityId: "*",
        summary: `Націнка +${markupPercent}%: оновлено ${updated}, пропущено ${skipped}`,
        data: { markupPercent, updated, skipped },
      });
      await afterCatalogWrite(ctx.db, ["/admin/products"], false);
      return { updated, skipped };
    },
  });
}

export async function bulkStockAction(input: unknown): Promise<ActionResult<{ updated: number }>> {
  return runAction({
    permission: "catalog:write",
    schema: z.object({ ids: idsSchema, stock: stockEnum }),
    input,
    run: async ({ ids, stock }, ctx) => {
      let updated = 0;
      for (const id of ids) {
        const doc = await getProductDoc(ctx.db, id);
        if (!doc) continue;
        if (doc.source === "ddtuning") await applyLocalPatch(ctx.db, id, { stock });
        else {
          const product = docToProduct(doc);
          product.stock = stock;
          await saveProduct(ctx.db, product, {});
        }
        updated++;
      }
      await ctx.audit({ action: "product.bulk_stock", entity: "product", entityId: "*", summary: `Наявність оновлено для ${updated} товарів` });
      await afterCatalogWrite(ctx.db, ["/admin/products"], false);
      return { updated };
    },
  });
}

export async function bulkHideAction(input: unknown): Promise<ActionResult<{ updated: number }>> {
  return runAction({
    permission: "catalog:write",
    schema: z.object({ ids: idsSchema, hidden: z.boolean() }),
    input,
    run: async ({ ids, hidden }, ctx) => {
      const updated = await setProductsHidden(ctx.db, ids, hidden);
      await ctx.audit({
        action: "product.bulk_hidden",
        entity: "product",
        entityId: "*",
        summary: hidden ? `Приховано ${updated} товарів` : `Показано ${updated} товарів`,
      });
      await afterCatalogWrite(ctx.db, ["/admin/products"], true);
      return { updated };
    },
  });
}

export async function importPricesAction(formData: unknown): Promise<ActionResult<{ updated: number; skipped: number; total: number }>> {
  const file = formData instanceof FormData ? formData.get("file") : null;
  if (file && typeof file !== "string" && file.size > MAX_IMPORT_BYTES) {
    return fail("Файл завеликий: до 8 МБ за один імпорт.");
  }
  const text = file && typeof file !== "string" ? await file.text() : "";
  return runAction({
    permission: "catalog:write",
    schema: z.object({ text: z.string().min(1, "Додайте CSV-файл із колонками sku;price;oldPrice;stock.") }),
    input: { text },
    run: async ({ text: csv }, ctx) => {
      const { rows } = parseCsv(csv);
      const forms = new Set<string>();
      for (const row of rows) {
        const sku = (row.sku ?? "").trim();
        if (sku) {
          forms.add(sku);
          forms.add(sku.toUpperCase());
        }
      }
      const docs = forms.size
        ? await cols(ctx.db)
            .products.find({ skus: { $in: [...forms] } }, { projection: { _id: 1, skus: 1, source: 1, price: 1 } })
            .toArray()
        : [];
      const bySku = new Map<string, { id: string; source: ProductDoc["source"]; price: number }>();
      for (const doc of docs) {
        for (const s of doc.skus ?? []) {
          const entry = { id: doc._id, source: doc.source, price: doc.price };
          bySku.set(s, entry);
          bySku.set(s.toUpperCase(), entry);
        }
      }

      let updated = 0;
      let skipped = 0;
      for (const row of rows) {
        const sku = (row.sku ?? "").trim();
        const hit = sku ? bySku.get(sku) ?? bySku.get(sku.toUpperCase()) : undefined;
        if (!hit) {
          skipped++;
          continue;
        }
        const price = parseNumber(row.price);
        const priceSet = Number.isFinite(price) && price >= 0;
        const hasOld = "oldprice" in row;
        const op = hasOld ? parseNumber(row.oldprice) : NaN;
        const basePrice = priceSet ? Math.round(price) : hit.price;
        const stockParsed = row.stock ? stockEnum.safeParse(row.stock.trim()) : undefined;

        if (hit.source === "ddtuning") {
          const patch: ProductLocal = {};
          if (priceSet) patch.price = Math.round(price);
          if (hasOld) {
            if (Number.isFinite(op) && op > basePrice) patch.oldPrice = Math.round(op);
            else if (row.oldprice.trim() === "" || op === 0) patch.oldPrice = null;
          }
          if (stockParsed?.success) patch.stock = stockParsed.data;
          if (Object.keys(patch).length === 0) {
            skipped++;
            continue;
          }
          await applyLocalPatch(ctx.db, hit.id, patch);
          updated++;
        } else {
          const doc = await getProductDoc(ctx.db, hit.id);
          if (!doc) {
            skipped++;
            continue;
          }
          const product = docToProduct(doc);
          let changed = false;
          if (priceSet) {
            product.price = Math.round(price);
            if (product.oldPrice && product.oldPrice <= product.price) delete product.oldPrice;
            changed = true;
          }
          if (hasOld) {
            if (Number.isFinite(op) && op > product.price) {
              product.oldPrice = Math.round(op);
              changed = true;
            } else if (row.oldprice.trim() === "" || op === 0) {
              if (product.oldPrice !== undefined) {
                delete product.oldPrice;
                changed = true;
              }
            }
          }
          if (stockParsed?.success) {
            product.stock = stockParsed.data;
            changed = true;
          }
          if (!changed) {
            skipped++;
            continue;
          }
          await saveProduct(ctx.db, product, {});
          updated++;
        }
      }

      await ctx.audit({
        action: "product.import_prices",
        entity: "product",
        entityId: "*",
        summary: `Імпорт цін: оновлено ${updated}, пропущено ${skipped}`,
        data: { updated, skipped, total: rows.length },
      });
      await afterCatalogWrite(ctx.db, ["/admin/products"], false);
      return { updated, skipped, total: rows.length };
    },
  });
}

/** Models of one make, for the fitment editor's lazy loading (read). */
export async function listModelsAction(input: unknown): Promise<ActionResult<{ models: { id: string; makeId: string; name: string }[] }>> {
  return runAction({
    permission: "catalog:read",
    schema: z.object({ makeId: z.string().trim().min(1).max(80) }),
    input,
    run: async ({ makeId }) => ({ models: await getModelsForMake(makeId) }),
  });
}

// ── categories ──────────────────────────────────────────────

const categorySchema = z.object({
  id: z.string().trim().max(80).optional(),
  parentId: z.string().trim().max(80).nullish(),
  name: z.string().trim().min(2, "Вкажіть назву категорії.").max(120),
  description: z.string().trim().max(600).optional(),
  icon: z.string().trim().max(40).optional(),
  illustration: z.string().trim().max(80).optional(),
});

async function uniqueCategorySlug(db: Db, base: string): Promise<string> {
  const root = base || "kategoriia";
  let slug = root;
  let n = 2;
  while (await cols(db).categories.findOne({ _id: slug }, { projection: { _id: 1 } })) slug = `${root}-${n++}`;
  return slug;
}

export async function saveCategoryAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction({
    permission: "catalog:write",
    schema: categorySchema,
    input,
    run: async (data, ctx) => {
      if (data.id) {
        const doc = await cols(ctx.db).categories.findOne({ _id: data.id });
        if (!doc) throw new ActionError("Категорію не знайдено.");
        const isGroup = doc.parentId === null;
        const local: Record<string, string> = { ...(doc.local ?? {}) } as Record<string, string>;
        const setOrClear = (key: string, value: string | undefined, base: string | undefined) => {
          const v = value?.trim() ?? "";
          if (v && v !== (base ?? "")) local[key] = v;
          else delete local[key];
        };
        setOrClear("name", data.name, doc.name);
        if (isGroup) {
          setOrClear("description", data.description, doc.description);
          setOrClear("icon", data.icon, doc.icon);
        } else {
          setOrClear("illustration", data.illustration, doc.illustration);
        }
        const update = Object.keys(local).length
          ? { $set: { local: local as CategoryDoc["local"], updatedAt: nowIso() } }
          : { $set: { updatedAt: nowIso() }, $unset: { local: "" as const } };
        await cols(ctx.db).categories.updateOne({ _id: data.id }, update);
        await ctx.audit({ action: "category.save", entity: "category", entityId: data.id, summary: `Категорію «${data.name}» збережено` });
        await afterCatalogWrite(ctx.db, ["/admin/categories", "/admin/products"], false);
        return { id: data.id };
      }

      const parentId = data.parentId?.trim();
      if (!parentId) throw new ActionError("Оберіть групу для нової категорії.");
      const parent = await cols(ctx.db).categories.findOne({ _id: parentId });
      if (!parent || parent.parentId !== null) throw new ActionError("Групу не знайдено.");
      const slug = await uniqueCategorySlug(ctx.db, slugify(data.name));
      const doc: CategoryDoc = {
        _id: slug,
        slug,
        name: data.name,
        parentId,
        illustration: data.illustration?.trim() || "_fallback",
        supplierIds: [],
        productCount: 0,
        sort: 9990,
        hidden: false,
        updatedAt: nowIso(),
      };
      if (data.description?.trim()) doc.description = data.description.trim();
      await cols(ctx.db).categories.insertOne(doc);
      await ctx.audit({ action: "category.create", entity: "category", entityId: slug, summary: `Категорію «${data.name}» створено` });
      await afterCatalogWrite(ctx.db, ["/admin/categories", "/admin/products"], false);
      return { id: slug };
    },
  });
}

export async function setCategoryHiddenAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "catalog:write",
    schema: z.object({ id: z.string().min(1), hidden: z.boolean() }),
    input,
    run: async ({ id, hidden }, ctx) => {
      const result = await cols(ctx.db).categories.updateOne({ _id: id }, { $set: { hidden, updatedAt: nowIso() } });
      if (!result.matchedCount) throw new ActionError("Категорію не знайдено.");
      await ctx.audit({
        action: "category.hidden",
        entity: "category",
        entityId: id,
        summary: hidden ? `Категорію ${id} приховано` : `Категорію ${id} показано`,
      });
      await afterCatalogWrite(ctx.db, ["/admin/categories", "/admin/products"], true);
      return undefined;
    },
  });
}

// ── brands ──────────────────────────────────────────────────

const brandSchema = z.object({
  id: z.string().trim().max(80).optional(),
  name: z.string().trim().min(1, "Вкажіть назву бренду.").max(120),
  country: z.string().trim().max(80).default(""),
  description: z.string().trim().max(1000).default(""),
  popular: z.boolean().default(false),
});

async function uniqueBrandSlug(db: Db, base: string): Promise<string> {
  const root = base || "brend";
  let slug = root;
  let n = 2;
  while (await cols(db).brands.findOne({ _id: slug }, { projection: { _id: 1 } })) slug = `${root}-${n++}`;
  return slug;
}

export async function saveBrandAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction({
    permission: "catalog:write",
    schema: brandSchema,
    input,
    run: async (data, ctx) => {
      if (data.id) {
        const doc = await cols(ctx.db).brands.findOne({ _id: data.id });
        if (!doc) throw new ActionError("Бренд не знайдено.");
        const local: Record<string, string | boolean> = { ...(doc.local ?? {}) } as Record<string, string | boolean>;
        const setText = (key: string, value: string | undefined, base: string | undefined) => {
          const v = value?.trim() ?? "";
          if (v && v !== (base ?? "")) local[key] = v;
          else delete local[key];
        };
        setText("name", data.name, doc.name);
        setText("country", data.country, doc.country);
        setText("description", data.description, doc.description);
        if (data.popular !== Boolean(doc.popular)) local.popular = data.popular;
        else delete local.popular;
        const update = Object.keys(local).length
          ? { $set: { local: local as typeof doc.local, updatedAt: nowIso() } }
          : { $set: { updatedAt: nowIso() }, $unset: { local: "" as const } };
        await cols(ctx.db).brands.updateOne({ _id: data.id }, update);
        await ctx.audit({ action: "brand.save", entity: "brand", entityId: data.id, summary: `Бренд «${data.name}» збережено` });
        await afterCatalogWrite(ctx.db, ["/admin/brands", "/admin/products"], false);
        return { id: data.id };
      }

      const slug = await uniqueBrandSlug(ctx.db, slugify(data.name));
      await cols(ctx.db).brands.insertOne({
        _id: slug,
        slug,
        name: data.name,
        country: data.country,
        description: data.description,
        ...(data.popular ? { popular: true } : {}),
        productCount: 0,
        hidden: false,
        updatedAt: nowIso(),
      });
      await ctx.audit({ action: "brand.create", entity: "brand", entityId: slug, summary: `Бренд «${data.name}» створено` });
      await afterCatalogWrite(ctx.db, ["/admin/brands", "/admin/products"], false);
      return { id: slug };
    },
  });
}

export async function setBrandHiddenAction(input: unknown): Promise<ActionResult<undefined>> {
  return runAction({
    permission: "catalog:write",
    schema: z.object({ id: z.string().min(1), hidden: z.boolean() }),
    input,
    run: async ({ id, hidden }, ctx) => {
      const result = await cols(ctx.db).brands.updateOne({ _id: id }, { $set: { hidden, updatedAt: nowIso() } });
      if (!result.matchedCount) throw new ActionError("Бренд не знайдено.");
      await ctx.audit({
        action: "brand.hidden",
        entity: "brand",
        entityId: id,
        summary: hidden ? `Бренд ${id} приховано` : `Бренд ${id} показано`,
      });
      await afterCatalogWrite(ctx.db, ["/admin/brands", "/admin/products"], true);
      return undefined;
    },
  });
}
