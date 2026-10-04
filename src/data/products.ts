import { brands } from "@/data/brands";
import { categories } from "@/data/categories";
import { makes, models } from "@/data/makes";
import {
  productTemplates,
  type CategoryTemplate,
  type SpecDef,
} from "@/data/product-templates";
import type {
  Product,
  ProductBadge,
  ProductFitment,
  ProductOption,
  ProductSpec,
  StockStatus,
} from "@/lib/types";

/*
 * Deterministic catalog generator. No Math.random / Date.now — everything comes
 * from a seeded PRNG (mulberry32) and the fixed catalog date 2026-10-01, so the
 * exported `products` array is identical on every import and across machines.
 */

// ── seeded PRNG ─────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(0x5eed1a7f);
const rnd = () => rng();
const randInt = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const chance = (p: number) => rnd() < p;

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

// ── transliteration / slug ──────────────────────────────────
const translit: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh",
  з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", ъ: "", ы: "y", э: "e", ё: "e",
  // latin letters with diacritics found in make/brand names (Škoda, Citroën, Lemförder…)
  š: "s", ž: "z", č: "c", ć: "c", ö: "o", ü: "u", ä: "a", ë: "e", é: "e", è: "e",
  á: "a", à: "a", â: "a", í: "i", ó: "o", ú: "u", ñ: "n", ç: "c", ã: "a", õ: "o",
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => translit[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

// ── lookups ─────────────────────────────────────────────────
const brandById = new Map(brands.map((b) => [b.id, b]));
const makeById = new Map(makes.map((m) => [m.id, m]));
const modelById = new Map(models.map((m) => [m.id, m]));
const leafCategories = categories.filter((c) => c.parentId !== null);
const templateByCategory = new Map(productTemplates.map((t) => [t.categoryId, t]));

const vehicleLabel = (modelId: string): string => {
  const model = modelById.get(modelId)!;
  return `${makeById.get(model.makeId)!.name} ${model.name}`;
};

// ── platform groups (fitment is chosen within one group → siblings) ─
const RAW_GROUPS: string[][] = [
  ["volkswagen-golf-vii", "skoda-octavia-a7", "seat-leon-iii", "audi-a3-8v"],
  ["skoda-octavia-a8"],
  ["volkswagen-golf-vi", "skoda-octavia-a5", "seat-leon-ii", "audi-a3-8p", "volkswagen-tiguan-i"],
  ["volkswagen-polo-v", "skoda-fabia-ii", "seat-ibiza-6j", "skoda-rapid", "seat-toledo-iv"],
  ["volkswagen-passat-b7", "volkswagen-passat-b8", "skoda-superb-ii"],
  ["audi-a4-b8", "audi-a4-b9", "audi-a6-c7", "audi-q5-8r"],
  ["bmw-3-e90", "bmw-5-e60", "bmw-x5-e70"],
  ["bmw-3-f30", "bmw-5-f10"],
  ["mercedes-benz-c-w204", "mercedes-benz-e-w212"],
  ["mercedes-benz-c-w205"],
  ["mercedes-benz-sprinter-w906", "mercedes-benz-vito-w639"],
  ["opel-astra-h"],
  ["opel-astra-j", "chevrolet-cruze"],
  ["opel-astra-k"],
  ["opel-insignia-a"],
  ["opel-corsa-d"],
  ["opel-vivaro-a", "renault-trafic-ii"],
  ["ford-focus-ii", "volvo-s40-ii", "volvo-v50"],
  ["ford-focus-iii", "ford-kuga-ii"],
  ["ford-fiesta-vi"],
  ["ford-mondeo-iv"],
  ["ford-transit-vii"],
  ["renault-megane-ii"],
  ["renault-megane-iii"],
  ["renault-logan-i", "dacia-logan-i", "dacia-sandero-i", "renault-duster-i", "dacia-duster-i", "dacia-logan-ii"],
  ["renault-kangoo-ii"],
  ["nissan-qashqai-j10", "nissan-x-trail-t31"],
  ["nissan-qashqai-j11"],
  ["nissan-juke-f15"],
  ["nissan-micra-k12"],
  ["peugeot-307", "citroen-c4-i"],
  ["peugeot-308-t7", "citroen-c4-ii"],
  ["peugeot-308-t9"],
  ["peugeot-407", "citroen-c5-ii"],
  ["peugeot-partner-ii", "citroen-berlingo-ii"],
  ["fiat-doblo-ii"],
  ["fiat-punto-iii"],
  ["fiat-ducato-iii"],
  ["fiat-500"],
  ["toyota-corolla-e150", "toyota-corolla-e170"],
  ["toyota-camry-xv40", "toyota-camry-xv50", "lexus-es-xv60"],
  ["toyota-rav4-xa30"],
  ["toyota-avensis-t27"],
  ["lexus-rx-al10"],
  ["lexus-is-xe20"],
  ["lexus-nx-i"],
  ["honda-civic-viii"],
  ["honda-accord-viii"],
  ["honda-cr-v-iii", "honda-cr-v-iv"],
  ["mazda-3-bk", "mazda-3-bl"],
  ["mazda-6-gh"],
  ["mazda-cx-5-ke"],
  ["mitsubishi-lancer-ix", "mitsubishi-lancer-x"],
  ["mitsubishi-outlander-ii", "mitsubishi-asx"],
  ["subaru-forester-sh", "subaru-impreza-gh"],
  ["subaru-forester-sj"],
  ["subaru-outback-br"],
  ["suzuki-swift-iv"],
  ["suzuki-sx4-i"],
  ["suzuki-grand-vitara-iii", "suzuki-vitara-ii"],
  ["hyundai-accent-iii"],
  ["hyundai-accent-iv", "kia-rio-ub"],
  ["hyundai-elantra-md", "kia-ceed-jd", "hyundai-i30-fd", "kia-cerato-td", "kia-ceed-ed"],
  ["hyundai-tucson-lm", "kia-sportage-sl"],
  ["hyundai-santa-fe-cm", "kia-sorento-xm"],
  ["chevrolet-aveo-t250", "chevrolet-aveo-t300"],
  ["chevrolet-lacetti"],
  ["daewoo-lanos", "daewoo-sens"],
  ["daewoo-nexia"],
  ["daewoo-matiz"],
  ["volvo-xc90-i"],
  ["volvo-s60-i"],
];

// Drop any id that is not a real model (guards against typos, keeps generation safe).
const PLATFORM_GROUPS = RAW_GROUPS.map((g) => g.filter((id) => modelById.has(id))).filter((g) => g.length > 0);
const groupByModel = new Map<string, string[]>();
for (const g of PLATFORM_GROUPS) for (const id of g) if (!groupByModel.has(id)) groupByModel.set(id, g);

// ~44 common models that must each carry ≥6 products across several categories.
const POPULAR_MODELS = new Set<string>([
  "volkswagen-golf-vi", "volkswagen-golf-vii", "volkswagen-passat-b7", "volkswagen-passat-b8", "volkswagen-polo-v", "volkswagen-tiguan-i",
  "skoda-octavia-a5", "skoda-octavia-a7", "skoda-fabia-ii", "skoda-superb-ii", "skoda-rapid",
  "bmw-3-e90", "bmw-3-f30", "bmw-5-e60", "bmw-5-f10",
  "audi-a3-8p", "audi-a4-b8", "audi-a6-c7", "audi-q5-8r",
  "mercedes-benz-c-w204", "mercedes-benz-c-w205", "mercedes-benz-e-w212", "mercedes-benz-sprinter-w906",
  "toyota-corolla-e150", "toyota-corolla-e170", "toyota-camry-xv40", "toyota-rav4-xa30",
  "renault-megane-iii", "renault-logan-i", "renault-duster-i",
  "opel-astra-h", "opel-astra-j", "opel-insignia-a",
  "ford-focus-ii", "ford-focus-iii", "ford-kuga-ii",
  "hyundai-accent-iv", "hyundai-tucson-lm", "hyundai-santa-fe-cm",
  "kia-ceed-jd", "kia-sportage-sl", "kia-rio-ub",
  "nissan-qashqai-j10", "nissan-qashqai-j11",
]);

const ENGINES: Record<string, string[]> = {
  audi: ["1.6 TDI", "2.0 TDI", "1.4 TSI", "1.8 TFSI", "2.0 TFSI", "3.0 TDI"],
  volkswagen: ["1.6 TDI", "2.0 TDI", "1.4 TSI", "1.6 MPI", "1.8 TSI", "1.9 TDI"],
  skoda: ["1.6 TDI", "2.0 TDI", "1.4 TSI", "1.6 MPI", "1.2 TSI"],
  seat: ["1.6 TDI", "1.4 TSI", "1.2 TSI", "2.0 TDI"],
  bmw: ["2.0d", "3.0d", "2.0i", "2.5i", "3.0i", "1.6i"],
  "mercedes-benz": ["2.1 CDI", "2.2 CDI", "1.8 CGI", "3.0 CDI", "2.0"],
  opel: ["1.4", "1.6", "1.7 CDTI", "2.0 CDTI", "1.4 Turbo", "1.3 CDTI"],
  ford: ["1.6 TDCi", "2.0 TDCi", "1.6 Ti-VCT", "1.0 EcoBoost", "1.8 TDCi"],
  renault: ["1.5 dCi", "1.6 16V", "1.9 dCi", "2.0 dCi", "1.4 16V"],
  dacia: ["1.5 dCi", "1.6 16V", "1.6 MPI", "1.4 MPI"],
  peugeot: ["1.6 HDi", "2.0 HDi", "1.6 VTi", "1.4 HDi", "1.6 THP"],
  citroen: ["1.6 HDi", "2.0 HDi", "1.6 VTi", "1.4 HDi"],
  fiat: ["1.3 MultiJet", "1.6 MultiJet", "1.4", "2.0 MultiJet"],
  toyota: ["1.6 VVT-i", "2.0 D-4D", "1.4 D-4D", "2.4", "2.5", "3.5 V6"],
  lexus: ["2.5", "3.5 V6", "2.0", "2.2 D"],
  honda: ["1.8 i-VTEC", "2.0 i-VTEC", "2.2 i-DTEC", "2.4 i-VTEC"],
  nissan: ["1.5 dCi", "1.6", "2.0", "1.6 dCi", "2.0 dCi"],
  mazda: ["1.6", "2.0", "2.2 CD", "2.5"],
  mitsubishi: ["1.6", "1.8", "2.0 DI-D", "2.2 DI-D"],
  subaru: ["2.0", "2.5", "2.0D"],
  suzuki: ["1.6", "1.4", "2.0 DDiS", "1.9 DDiS"],
  hyundai: ["1.6 CRDi", "2.0 CRDi", "1.4", "1.6 GDI", "2.2 CRDi"],
  kia: ["1.6 CRDi", "2.0 CRDi", "1.4", "1.6 GDI", "2.2 CRDi"],
  chevrolet: ["1.6", "1.8", "1.4", "2.0 VCDi"],
  daewoo: ["1.5", "1.6", "1.5 16V", "1.4"],
  volvo: ["2.0 D", "2.4 D5", "1.6", "2.0 T"],
};

function engineNoteFor(makeId: string): string {
  const pool = ENGINES[makeId] ?? ["1.6", "2.0"];
  if (pool.length >= 2 && chance(0.4)) {
    const a = pick(pool);
    let b = pick(pool);
    let guard = 0;
    while (b === a && guard++ < 5) b = pick(pool);
    return a === b ? a : `${a}, ${b}`;
  }
  return pick(pool);
}

// ── spec / value helpers ────────────────────────────────────
const EN_DASH = "–";

function specValue(def: SpecDef): string {
  if ("pick" in def) return pick(def.pick);
  const { num, step = 1, unit } = def;
  const steps = Math.floor((num[1] - num[0]) / step);
  const v = num[0] + step * randInt(0, steps);
  return unit ? `${v} ${unit}` : `${v}`;
}

const CATALOG_MS = Date.UTC(2026, 9, 1); // 2026-10-01, fixed catalog date
const DAY = 86_400_000;
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function roundPrice(value: number): number {
  const v = chance(0.6) ? Math.round(value / 10) * 10 : Math.round(value / 5) * 5;
  return Math.max(5, v);
}

// coverage trackers
const modelCount = new Map<string, number>();
const modelCats = new Map<string, Set<string>>();

function bump(modelId: string, categoryId: string): void {
  modelCount.set(modelId, (modelCount.get(modelId) ?? 0) + 1);
  let set = modelCats.get(modelId);
  if (!set) {
    set = new Set();
    modelCats.set(modelId, set);
  }
  set.add(categoryId);
}

function fitmentRow(modelId: string, categoryId: string, engineNote: boolean): ProductFitment {
  const model = modelById.get(modelId)!;
  const from = model.yearFrom;
  const to = model.yearTo ?? 2026;
  let a = from;
  let b = to;
  const span = to - from;
  if (span > 3 && chance(0.3)) {
    a = from + randInt(0, Math.floor(span / 3));
    b = to - randInt(0, Math.floor(span / 3));
    if (a >= b) {
      a = from;
      b = to;
    }
  }
  bump(modelId, categoryId);
  const row: ProductFitment = { makeId: model.makeId, modelId, years: `${a}${EN_DASH}${b}` };
  if (engineNote && chance(0.55)) row.note = engineNoteFor(model.makeId);
  return row;
}

function chooseFitment(categoryId: string, engineNote: boolean): ProductFitment[] {
  const target = (id: string) => (POPULAR_MODELS.has(id) ? 7 : 2);
  const deficit = (id: string) => Math.max(0, target(id) - (modelCount.get(id) ?? 0));

  let best: string[] = PLATFORM_GROUPS[0];
  let bestScore = -Infinity;
  for (const g of PLATFORM_GROUPS) {
    let score = 0;
    for (const m of g) score += deficit(m);
    const s = score + rnd() * 0.9; // jitter spreads choice among similar groups
    if (s > bestScore) {
      bestScore = s;
      best = g;
    }
  }

  const members = [...best].sort((x, y) => {
    const dx = deficit(x);
    const dy = deficit(y);
    if (dy !== dx) return dy - dx;
    const lx = modelCats.get(x)?.has(categoryId) ? 1 : 0;
    const ly = modelCats.get(y)?.has(categoryId) ? 1 : 0;
    if (lx !== ly) return lx - ly; // prefer a model that lacks this category
    return rnd() - 0.5;
  });

  // Platform siblings share most parts, so a product usually lists several of them
  const k = Math.min(members.length, weightedPick([1, 2, 3, 4], [0.12, 0.3, 0.33, 0.25]));
  return members.slice(0, k).map((id) => fitmentRow(id, categoryId, engineNote));
}

// ── sku / slug / oem ────────────────────────────────────────
const usedSku = new Set<string>();
const usedSlug = new Set<string>();

function brandCode(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, "").toUpperCase();
  return letters.slice(0, 3) || "AF";
}

function makeSku(code: string): string {
  for (let attempt = 0; attempt < 10000; attempt++) {
    const digits = String(randInt(10000, 999999));
    const sep = weightedPick(["-", " ", ""], [0.6, 0.15, 0.25]);
    const sku = `${code}${sep}${digits}`;
    if (!usedSku.has(sku)) {
      usedSku.add(sku);
      return sku;
    }
  }
  throw new Error("SKU space exhausted");
}

function makeSlug(name: string, sku: string): string {
  const base = `${slugify(name)}-${sku.toLowerCase().replace(/\s+/g, "")}`
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  let slug = base;
  let n = 2;
  while (usedSlug.has(slug)) slug = `${base}-${n++}`;
  usedSlug.add(slug);
  return slug;
}

function letters(n: number): string {
  const A = "ABCDEFGHJKLMNPRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < n; i++) s += A[Math.floor(rnd() * A.length)];
  return s;
}
function digits(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += String(randInt(0, 9));
  return s;
}
function oemNumber(): string {
  switch (randInt(0, 3)) {
    case 0:
      return `${randInt(1, 9)}${letters(1)}${randInt(0, 9)} ${digits(3)} ${digits(3)}${chance(0.5) ? ` ${letters(1)}` : ""}`;
    case 1:
      return `${digits(2)} ${digits(2)} ${digits(3)} ${digits(2)}`;
    case 2:
      return `${letters(2)}${digits(6)}`;
    default:
      return `${letters(1)} ${digits(3)} ${digits(3)} ${digits(2)} ${digits(2)}`;
  }
}
function oemNumbers(): string[] {
  const n = randInt(1, 3);
  const out = new Set<string>();
  let guard = 0;
  while (out.size < n && guard++ < 20) out.add(oemNumber());
  return [...out];
}

// ── option builder ──────────────────────────────────────────
function buildOption(tpl: CategoryTemplate): ProductOption | undefined {
  if (!tpl.option) return undefined;
  const o = tpl.option;
  return {
    id: `${tpl.categoryId}-${slugify(o.name) || "opt"}`,
    name: o.name,
    values: o.values.map((v) => ({ id: v.key, label: v.label, priceDelta: v.priceDelta })),
  };
}

// ── description fill ────────────────────────────────────────
interface FillCtx {
  brand: string;
  vehicle: string;
  noun: string;
  variant: string;
  sku: string;
  specs: Record<string, string>;
}
function fill(t: string, ctx: FillCtx): string {
  const s = t
    .replace(/\{brand\}/g, ctx.brand)
    .replace(/\{vehicle\}/g, ctx.vehicle)
    .replace(/\{noun\}/g, ctx.noun)
    .replace(/\{variant\}/g, ctx.variant)
    .replace(/\{sku\}/g, ctx.sku)
    .replace(/\{spec:([^}]+)\}/g, (_, n: string) => ctx.specs[n] ?? "")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  // A paragraph may begin with a substituted spec value — ensure a capital first letter.
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── product builder ─────────────────────────────────────────
let idCounter = 0;

function buildProduct(tpl: CategoryTemplate, index: number): Product {
  const brand = brandById.get(tpl.brandIds[index % tpl.brandIds.length])!;
  const variant = tpl.variants ? tpl.variants[index % tpl.variants.length] : undefined;
  const noun = tpl.subtypes ? pick(tpl.subtypes) : tpl.noun;

  // specs
  const specs: ProductSpec[] = [];
  const specMap: Record<string, string> = {};
  if (variant?.spec) {
    specs.push({ name: variant.spec.name, value: variant.spec.value });
    specMap[variant.spec.name] = variant.spec.value;
  }
  for (const def of tpl.specs) {
    const value = specValue(def);
    specs.push({ name: def.name, value });
    specMap[def.name] = value;
  }

  // fitment + vehicle label
  const fitment = tpl.universal ? [] : chooseFitment(tpl.categoryId, Boolean(tpl.engineNote));
  const primary = fitment[0];
  const vehicle = primary ? vehicleLabel(primary.modelId) : "";

  // name
  const linePool = tpl.lines?.[brand.id];
  const line = linePool ? pick(linePool) : undefined;
  const option = buildOption(tpl);
  const defaultLabel = tpl.option ? tpl.option.values[tpl.option.defaultIndex ?? 0].label : undefined;

  let name: string;
  if (tpl.universal) {
    const parts = [noun, brand.name];
    if (line) parts.push(line);
    for (const s of tpl.nameSpecs ?? []) if (specMap[s]) parts.push(specMap[s]);
    name = parts.join(" ");
    if (tpl.option?.appendToName && defaultLabel) name += `, ${defaultLabel}`;
  } else {
    const parts = [noun];
    if (variant) parts.push(variant.name);
    parts.push(brand.name);
    if (vehicle) parts.push(vehicle);
    name = parts.join(" ");
  }

  // ids
  const sku = makeSku(brandCode(brand.name));
  const slug = makeSlug(name, sku);
  const id = `p-${String(++idCounter).padStart(4, "0")}`;

  // price
  const basePrice = roundPrice(randInt(tpl.price[0], tpl.price[1]));
  const badges: ProductBadge[] = [];
  let oldPrice: number | undefined;
  if (chance(0.24)) {
    const markup = 1 + randInt(5, 30) / 100;
    const raw = Math.round((basePrice * markup) / 10) * 10;
    oldPrice = Math.max(raw, basePrice + 10);
    badges.push("sale");
  }

  // stock + delivery are assigned later by a quota pass (see assignStock) so the
  // overall mix hits the target split exactly; start from a neutral placeholder.
  const stock: StockStatus = "in_stock";
  const deliveryDays: [number, number] = [1, 2];

  // rating + reviews (~25% have none)
  let rating = 0;
  let reviewsCount = 0;
  if (!chance(0.25)) {
    reviewsCount = 1 + Math.floor(rnd() * rnd() * 55);
    rating = Math.round((3.9 + rnd() * 1.1) * 10) / 10;
  }

  // createdAt (~14% within the last 30 days → "new"); always strictly before the catalog date
  let offsetDays: number;
  if (chance(0.14)) {
    offsetDays = randInt(1, 30);
    badges.push("new");
  } else {
    offsetDays = randInt(31, 540);
  }
  const createdAt = isoDate(CATALOG_MS - offsetDays * DAY);

  const popularity = randInt(0, 1000);

  // short description
  let shortDescription: string;
  if (tpl.universal) {
    const parts = [noun, brand.name];
    if (line) parts.push(line);
    const key = (tpl.nameSpecs ?? [])[0];
    if (key && specMap[key]) parts.push(specMap[key]);
    shortDescription = parts.join(" ");
  } else {
    shortDescription = `${noun}${variant ? ` ${variant.name}` : ""} ${brand.name} для ${vehicle}`;
  }

  const ctx: FillCtx = {
    brand: brand.name,
    vehicle,
    noun,
    variant: variant?.name ?? "",
    sku,
    specs: specMap,
  };
  const description = tpl.descriptions.map((d) => fill(d, ctx));

  return {
    id,
    slug,
    sku,
    oemNumbers: oemNumbers(),
    name,
    brandId: brand.id,
    categoryId: tpl.categoryId,
    price: basePrice,
    ...(oldPrice ? { oldPrice } : {}),
    stock,
    deliveryDays,
    images: [],
    badges,
    rating,
    reviewsCount,
    shortDescription,
    description,
    specs,
    fitment,
    universal: tpl.universal,
    ...(option ? { option } : {}),
    warrantyMonths: tpl.warrantyMonths,
    createdAt,
    popularity,
  };
}

// ── generate (taxonomy order, then a coverage top-up) ───────
function generate(): Product[] {
  const list: Product[] = [];
  const builtPerCategory = new Map<string, number>();
  const usedNames = new Set<string>();
  const build = (tpl: CategoryTemplate) => {
    const index = builtPerCategory.get(tpl.categoryId) ?? 0;
    builtPerCategory.set(tpl.categoryId, index + 1);
    let product = buildProduct(tpl, index);
    // Universal products are named from brand + line + key spec only, so two rolls can
    // collide; re-roll until the name is new. (Vehicle-specific ones are left alone:
    // re-rolling them would distort the fitment coverage counters.)
    for (let attempt = 0; tpl.universal && usedNames.has(product.name) && attempt < 12; attempt++) {
      product = buildProduct(tpl, index + attempt + 1);
    }
    usedNames.add(product.name);
    list.push(product);
  };

  const vehicleTemplates: CategoryTemplate[] = [];
  for (const cat of leafCategories) {
    const tpl = templateByCategory.get(cat.id);
    if (!tpl) continue;
    if (!tpl.universal) vehicleTemplates.push(tpl);
    const range = tpl.count ?? [3, 6];
    const count = range[0] === range[1] ? range[0] : weightedPick([3, 4, 5, 6], [0.25, 0.35, 0.25, 0.15]);
    const n = Math.max(range[0], Math.min(range[1], count));
    for (let j = 0; j < n; j++) build(tpl);
  }

  // Coverage top-up. Fitment never leaves a platform group, so instead of attaching unrelated
  // vehicles to existing products we keep adding products (round-robin over the vehicle-specific
  // categories; chooseFitment() always serves the least covered group) until every popular model
  // has ≥6 products in ≥3 categories and every other model has ≥2.
  const covered = () =>
    models.every((model) => {
      const count = modelCount.get(model.id) ?? 0;
      if (!POPULAR_MODELS.has(model.id)) return count >= 2;
      return count >= 6 && (modelCats.get(model.id)?.size ?? 0) >= 3;
    });
  for (let extra = 0; !covered() && extra < 300; extra++) {
    build(vehicleTemplates[extra % vehicleTemplates.length]);
  }
  return list;
}

const all = generate();
// Re-rolled duplicates leave gaps in the running counter: number the final list consecutively
all.forEach((p, i) => {
  p.id = `p-${String(i + 1).padStart(4, "0")}`;
});

// ── "hit" badge = top ~14% by popularity ────────────────────
const sortedPop = [...all].map((p) => p.popularity).sort((a, b) => a - b);
const hitThreshold = sortedPop[Math.floor(sortedPop.length * 0.86)] ?? 1001;
for (const p of all) {
  if (p.popularity >= hitThreshold && !p.badges.includes("hit")) p.badges.push("hit");
}

// ── stock: deterministic 68/12/13/7 split across a shuffled order ───
function deliveryFor(stock: StockStatus): [number, number] {
  if (stock === "preorder") return pick([[5, 10], [7, 14]] as [number, number][]);
  if (stock === "out_of_stock") return [7, 14];
  return pick([[1, 2], [1, 3]] as [number, number][]);
}
function assignStock(list: Product[]): void {
  const total = list.length;
  const inStock = Math.round(total * 0.68);
  const low = Math.round(total * 0.12);
  const pre = Math.round(total * 0.13);
  const labels: StockStatus[] = list.map((_, i) =>
    i < inStock ? "in_stock" : i < inStock + low ? "low_stock" : i < inStock + low + pre ? "preorder" : "out_of_stock",
  );
  const order = list.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  order.forEach((productIdx, slot) => {
    const p = list[productIdx];
    p.stock = labels[slot];
    p.deliveryDays = deliveryFor(labels[slot]);
  });
}
assignStock(all);

export const products: Product[] = all;
