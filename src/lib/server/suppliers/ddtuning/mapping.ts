import { translateValue } from "@/data/ddtuning/category-names.uk";
import type { Product, ProductFitment, ProductOption, ProductSpec, StockStatus } from "@/lib/types";
import { hashString, slugify } from "@/lib/slug";
import type { ProductDoc, SupplierItem } from "@/lib/server/db/collections";
import { activeSale, roundPrice, stockRankOf } from "@/lib/server/catalog/product-doc";
import type { RawItem } from "./client";
import { toUah, type Rates } from "./rates";

/*
 * Pure mapping from supplier rows to storefront products. No database access here: the sync
 * passes resolved category / brand / vehicle references through `BuildContext`.
 */

// ── supplier item ───────────────────────────────────────────

export interface RawCost {
  price: number;
  currency: string;
  quantity: number;
}

function asCurrency(value: string | undefined): "EUR" | "USD" | "UAH" | undefined {
  const code = (value ?? "").trim().toUpperCase();
  if (code === "EUR" || code === "USD" || code === "UAH") return code;
  return undefined;
}

export function toSupplierItem(raw: RawItem, cost?: RawCost): SupplierItem {
  const clean = (v: string | undefined) => {
    const t = (v ?? "").trim();
    return t ? t : undefined;
  };
  const qty = Math.max(0, Math.round(Number(raw.quantity ?? raw.available_in_stock ?? 0) || 0));
  const item: SupplierItem = {
    id: Number(raw.id),
    sku: String(raw.sku ?? "").trim(),
    title: String(raw.title ?? "").trim(),
    price: Math.max(0, Math.round(Number(raw.price) || 0)),
    qty,
    images: Array.isArray(raw.images) ? raw.images.filter((u) => typeof u === "string" && u.startsWith("http")) : [],
  };
  const short = clean(raw.short_title);
  if (short) item.short = short;
  if (raw.sale_price && Number(raw.sale_price) > 0) {
    item.salePrice = Math.round(Number(raw.sale_price));
    if (raw.sale_start_at) item.saleStart = raw.sale_start_at.slice(0, 10);
    if (raw.sale_end_at) item.saleEnd = raw.sale_end_at.slice(0, 10);
  }
  const warehouse = clean(raw.warehouse);
  if (warehouse) item.warehouse = warehouse;
  for (const key of ["manufacturer", "country", "material", "installation", "kit", "color", "type", "place"] as const) {
    const value = clean(raw[key]);
    if (value) item[key] = value;
  }
  if (cost && isRealCost(cost)) {
    const currency = asCurrency(cost.currency) ?? "UAH";
    item.cost = { amount: Math.round(cost.price * 100) / 100, currency };
  }
  return item;
}

/**
 * The wholesale list carries a token price of 1 USD / 1 EUR for lines whose cost is negotiated
 * separately (forged wheels, body kits…). Such rows are not a cost: the product keeps its retail
 * price, but no purchase cost or margin is derived from them.
 */
export function isRealCost(cost: RawCost): boolean {
  if (!(cost.price > 0)) return false;
  const currency = asCurrency(cost.currency) ?? "UAH";
  return currency === "UAH" || cost.price > 1;
}

/** The best wholesale row for an item: in stock and cheapest (in UAH) wins */
export function pickBestCost(rows: RawCost[], rates: Rates): RawCost | undefined {
  const priced = rows.filter(isRealCost);
  if (priced.length === 0) return undefined;
  const value = (r: RawCost) => toUah(r.price, asCurrency(r.currency) ?? "UAH", rates);
  const inStock = priced.filter((r) => r.quantity > 0);
  const pool = inStock.length ? inStock : priced;
  return pool.reduce((best, r) => (value(r) < value(best) ? r : best));
}

// ── vehicle ─────────────────────────────────────────────────

export interface ParsedModel {
  universal: boolean;
  makeName: string;
  modelName: string;
  yearFrom: number | null;
  yearTo: number | null;
}

const YEARS_RE = /(\d{4})\s*[-–—]\s*(\d{4})?\s*(?:гг?\.?|рр?\.?)?\s*$/i;
const UNIVERSAL_RE = /^(универс|універс|all|усі|все)/i;

export function parseModel(mark: string, model: string): ParsedModel {
  const makeName = (mark ?? "").trim();
  let name = (model ?? "").trim();
  if (!makeName || UNIVERSAL_RE.test(makeName) || UNIVERSAL_RE.test(name)) {
    return { universal: true, makeName: "", modelName: "", yearFrom: null, yearTo: null };
  }
  let yearFrom: number | null = null;
  let yearTo: number | null = null;
  const m = YEARS_RE.exec(name);
  if (m) {
    yearFrom = Number(m[1]);
    yearTo = m[2] ? Number(m[2]) : null;
    name = name.slice(0, m.index).trim();
  }
  name = name.replace(/\s*(гг?|рр?)\.?$/i, "").trim();
  if (name.toLowerCase().startsWith(makeName.toLowerCase())) name = name.slice(makeName.length).trim();
  name = name.replace(/^[-–—:,]+/, "").trim();
  if (!name) name = "Усі моделі";
  return { universal: false, makeName, modelName: name, yearFrom, yearTo };
}

export function makeSlugOf(makeName: string): string {
  return slugify(makeName) || "make";
}

export function modelSlugOf(parsed: ParsedModel): string {
  if (parsed.modelName === "Усі моделі") return "all";
  return slugify(`${parsed.modelName} ${parsed.yearFrom ?? ""}`) || "model";
}

// ── stock & prices ──────────────────────────────────────────

const IN_TRANSIT_RE = /в дорозі|в дороге|в пути/i;
const ON_REQUEST_RE = /уточн/i;

/** The supplier publishes small quantities (mostly 1–2) that mean "available", not a real count */
export function stockFor(item: Pick<SupplierItem, "qty" | "warehouse">): StockStatus {
  if (item.qty > 0) return "in_stock";
  const warehouse = item.warehouse ?? "";
  if (IN_TRANSIT_RE.test(warehouse) || ON_REQUEST_RE.test(warehouse)) return "preorder";
  return "out_of_stock";
}

export function deliveryDaysFor(stock: StockStatus): [number, number] {
  switch (stock) {
    case "in_stock":
    case "low_stock":
      return [1, 3];
    case "preorder":
      return [5, 14];
    default:
      return [7, 21];
  }
}

export interface PricingPolicy {
  priceSource: "retail" | "cost_markup";
  /** Percent added to the supplier retail price (or to the cost in cost_markup mode) */
  markupPercent: number;
  /** 0 = automatic rounding (5 / 10 ₴ steps) */
  roundTo: number;
}

export function costUah(item: Pick<SupplierItem, "cost">, rates: Rates): number | undefined {
  if (!item.cost || !(item.cost.amount > 0)) return undefined;
  return Math.round(toUah(item.cost.amount, item.cost.currency, rates));
}

export function priceFor(item: SupplierItem, policy: PricingPolicy, rates: Rates, today = new Date()): { price: number; oldPrice?: number; sale: boolean } {
  const sale = activeSale(item, today);
  const markup = (value: number) => (policy.markupPercent ? roundPrice(value * (1 + policy.markupPercent / 100), policy.roundTo) : policy.roundTo > 1 ? roundPrice(value, policy.roundTo) : value);
  if (policy.priceSource === "cost_markup") {
    const cost = costUah(item, rates);
    if (cost) return { price: roundPrice(cost * (1 + policy.markupPercent / 100), policy.roundTo), sale: false };
  }
  const price = markup(sale ? item.salePrice! : item.price);
  const oldPrice = sale ? markup(item.price) : undefined;
  return oldPrice && oldPrice > price ? { price, oldPrice, sale } : { price, sale: false };
}

// ── text ────────────────────────────────────────────────────

export function specsFor(item: SupplierItem): ProductSpec[] {
  const specs: ProductSpec[] = [];
  const push = (name: string, value: string | undefined) => {
    const v = translateValue(value);
    if (v) specs.push({ name, value: v });
  };
  push("Виробник", item.manufacturer);
  push("Країна", item.country);
  push("Матеріал", item.material);
  push("Встановлення", item.installation);
  push("Комплект", item.kit);
  push("Колір", item.color);
  push("Тип", item.type);
  push("Розташування", item.place);
  return specs;
}

function vehicleLabel(parsed: ParsedModel): string {
  if (parsed.universal) return "";
  const years = parsed.yearFrom ? ` (${parsed.yearFrom}–${parsed.yearTo ?? "дотепер"})` : "";
  return parsed.modelName === "Усі моделі" ? `${parsed.makeName}` : `${parsed.makeName} ${parsed.modelName}${years}`;
}

export function shortDescriptionFor(item: SupplierItem, parsed: ParsedModel): string {
  const parts: string[] = [];
  const material = translateValue(item.material);
  const installation = translateValue(item.installation);
  const kit = item.kit?.trim();
  if (kit) parts.push(`Комплект: ${kit}`);
  if (material) parts.push(`Матеріал: ${material.toLowerCase()}`);
  if (installation) parts.push(`Встановлення: ${installation.toLowerCase()}`);
  const vehicle = vehicleLabel(parsed);
  const head = vehicle ? `Для ${vehicle}.` : "Універсальний аксесуар.";
  const text = [head, parts.join(" · ") + (parts.length ? "." : "")].filter(Boolean).join(" ");
  return text.length <= 180 ? text : `${text.slice(0, 177)}…`;
}

export function descriptionFor(title: string, item: SupplierItem, parsed: ParsedModel): string[] {
  const paragraphs: string[] = [];
  const vehicle = vehicleLabel(parsed);
  paragraphs.push(
    vehicle
      ? `${title} — аксесуар, виготовлений спеціально для ${vehicle}: повторює геометрію кузова й встановлюється без доопрацювань.`
      : `${title} — універсальний автоаксесуар, який підходить для більшості легкових авто.`,
  );
  const attrs: string[] = [];
  const material = translateValue(item.material);
  const installation = translateValue(item.installation);
  const color = translateValue(item.color);
  const country = translateValue(item.country);
  const manufacturer = item.manufacturer?.trim();
  if (material) attrs.push(`матеріал — ${material.toLowerCase()}`);
  if (color) attrs.push(`колір — ${color.toLowerCase()}`);
  if (installation) attrs.push(`встановлення — ${installation.toLowerCase()}`);
  if (item.kit) attrs.push(`у комплекті — ${item.kit.trim()}`);
  if (attrs.length) paragraphs.push(`Характеристики: ${attrs.join("; ")}.`);
  if (manufacturer) paragraphs.push(`Виробник: ${manufacturer}${country ? ` (${country})` : ""}. Артикул постачальника: ${item.sku}.`);
  paragraphs.push(
    "Перед замовленням звірте модель і рік випуску свого авто з таблицею сумісності. Якщо є сумніви — надішліть нам VIN або фото, і ми перевіримо підбір перед відправленням.",
  );
  return paragraphs;
}

// ── product assembly ────────────────────────────────────────

export interface CategoryRef {
  id: string;
  groupId: string;
  name: string;
  illustration: string;
}

export interface BrandRef {
  id: string;
  name: string;
}

export interface VehicleRef {
  universal: boolean;
  fitment: ProductFitment[];
  markName?: string;
  modelName?: string;
}

export interface BuildContext {
  rates: Rates;
  policy: PricingPolicy;
  now: string;
  /** Products first seen after this moment get the «new» badge for 30 days */
  firstSyncAt?: string;
  resolveCategory: (category: string, subcategory: string) => CategoryRef;
  resolveBrand: (manufacturer: string | undefined, country: string | undefined) => BrandRef;
  resolveVehicle: (parsed: ParsedModel) => VehicleRef;
}

export interface GroupInput {
  items: SupplierItem[];
  parentId: number | null;
  parentTitle?: string;
  mark: string;
  model: string;
  category: string;
  subcategory: string;
}

export interface BuiltProduct {
  product: Product;
  skus: string[];
  supplier: NonNullable<ProductDoc["supplier"]>;
}

const MAX_SLUG = 110;

export function productIdFor(group: GroupInput): string {
  return group.items.length > 1 && group.parentId ? `dd-g${group.parentId}` : `dd-${group.items[0].id}`;
}

export function buildProduct(group: GroupInput, ctx: BuildContext, existingCreatedAt?: string): BuiltProduct {
  if (group.items.length === 0) throw new Error("Порожня група товарів постачальника");
  const parsed = parseModel(group.mark, group.model);
  const priced = group.items.map((item) => ({ item, ...priceFor(item, ctx.policy, ctx.rates), stock: stockFor(item) }));
  priced.sort((a, b) => stockRankOf(a.stock) - stockRankOf(b.stock) || a.price - b.price || a.item.id - b.item.id);
  const base = priced[0];
  const isGroup = group.items.length > 1 && Boolean(group.parentId);
  const title = (isGroup && group.parentTitle?.trim()) || base.item.title;
  const vehicleSuffix = parsed.universal ? "" : parsed.modelName === "Усі моделі" ? parsed.makeName : `${parsed.makeName} ${parsed.modelName}`;
  const name = vehicleSuffix ? `${title} ${vehicleSuffix}` : title;
  const id = productIdFor(group);
  const slugBase = slugify(name).slice(0, MAX_SLUG).replace(/-+$/, "");
  const slug = `${slugBase || "tovar"}-${isGroup ? `g${group.parentId}` : base.item.id}`;

  const category = ctx.resolveCategory(group.category, group.subcategory);
  const brand = ctx.resolveBrand(base.item.manufacturer, base.item.country);
  const vehicle = ctx.resolveVehicle(parsed);

  const images: string[] = [];
  for (const { item } of priced) for (const url of item.images) if (!images.includes(url)) images.push(url);

  const createdAt = existingCreatedAt ?? ctx.now;
  const badges: Product["badges"] = [];
  if (base.sale) badges.push("sale");
  if (ctx.firstSyncAt && createdAt > ctx.firstSyncAt && Date.parse(ctx.now) - Date.parse(createdAt) < 30 * 24 * 3600 * 1000) badges.push("new");

  const inStockAny = priced.some((p) => p.stock === "in_stock" || p.stock === "low_stock");
  const popularity = (inStockAny ? 100 : base.stock === "preorder" ? 40 : 0) + Math.min(images.length, 5) * 2 + (base.sale ? 5 : 0) + (hashString(id) % 10);

  const product: Product = {
    id,
    slug,
    sku: base.item.sku,
    oemNumbers: [],
    name,
    brandId: brand.id,
    categoryId: category.id,
    price: base.price,
    stock: base.stock,
    deliveryDays: deliveryDaysFor(base.stock),
    images,
    badges,
    rating: 0,
    reviewsCount: 0,
    shortDescription: shortDescriptionFor(base.item, parsed),
    description: descriptionFor(title, base.item, parsed),
    specs: specsFor(base.item),
    fitment: vehicle.fitment,
    universal: vehicle.universal,
    warrantyMonths: 12,
    createdAt,
    popularity,
    brandName: brand.name,
    categoryName: category.name,
    illustration: category.illustration,
    groupId: category.groupId,
  };
  if (base.oldPrice) product.oldPrice = base.oldPrice;
  if (vehicle.markName) product.markName = vehicle.markName;
  if (vehicle.modelName) product.modelName = vehicle.modelName;

  if (isGroup) {
    const option: ProductOption = {
      id: "variant",
      name: "Варіант",
      values: priced.map((p) => {
        const value: ProductOption["values"][number] = {
          id: `v${p.item.id}`,
          label: p.item.short || p.item.title,
          priceDelta: p.price - base.price,
          stock: p.stock,
          sku: p.item.sku,
        };
        if (p.item.images[0]) value.image = p.item.images[0];
        return value;
      }),
    };
    product.option = option;
  }

  const costPrice = costUah(base.item, ctx.rates);
  const supplier: BuiltProduct["supplier"] = {
    code: "DDT",
    items: priced.map((p) => p.item),
    syncedAt: ctx.now,
  };
  if (group.parentId) supplier.groupId = group.parentId;
  if (costPrice) {
    supplier.costPrice = costPrice;
    supplier.costCurrency = base.item.cost!.currency;
    supplier.costOriginal = base.item.cost!.amount;
  }

  return { product, skus: [...new Set(priced.map((p) => p.item.sku).filter(Boolean))], supplier };
}

/** Cost / sku of the variant a buyer picked (or of the base item) for order lines */
export function variantCost(doc: Pick<ProductDoc, "supplier" | "option" | "sku">, optionValueId: string | undefined, rates: Rates): { sku: string; costPrice?: number } {
  const items = doc.supplier?.items ?? [];
  if (optionValueId) {
    const itemId = Number(optionValueId.replace(/^v/, ""));
    const item = items.find((i) => i.id === itemId);
    if (item) return { sku: item.sku, costPrice: costUah(item, rates) };
  }
  const base = items[0];
  return base ? { sku: base.sku, costPrice: costUah(base, rates) } : { sku: doc.sku };
}
