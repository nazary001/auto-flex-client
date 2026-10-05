import type { Product, StockStatus } from "@/lib/types";
import { fold, normalizeCode } from "@/lib/slug";
import type { ProductDoc, ProductLocal, ProductSource, SupplierItem } from "@/lib/server/db/collections";

/*
 * Conversions between the storefront `Product` and the stored `ProductDoc`.
 */

export function stockRankOf(stock: StockStatus): 0 | 1 | 2 | 3 {
  switch (stock) {
    case "in_stock":
      return 0;
    case "low_stock":
      return 1;
    case "preorder":
      return 2;
    default:
      return 3;
  }
}

/** Folded text for the `$text` index: name, codes, brand, vehicle and category */
export function buildSearchText(product: Product, skus: string[]): string {
  const codes = new Set<string>();
  for (const code of [product.sku, ...product.oemNumbers, ...skus]) {
    if (!code) continue;
    codes.add(code.toLowerCase());
    codes.add(normalizeCode(code));
  }
  return fold(
    [
      product.name,
      product.brandName ?? "",
      product.markName ?? "",
      product.modelName ?? "",
      product.categoryName ?? "",
      ...codes,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

const INTERNAL_KEYS = new Set(["_id", "source", "hidden", "retired", "stockRank", "search", "skus", "supplier", "local", "updatedAt"]);

export function docToProduct(doc: ProductDoc): Product {
  const out: Record<string, unknown> = { id: doc._id };
  for (const [key, value] of Object.entries(doc)) {
    if (INTERNAL_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out as unknown as Product;
}

export interface ProductDocMeta {
  source: ProductSource;
  hidden?: boolean;
  retired?: boolean;
  skus?: string[];
  supplier?: ProductDoc["supplier"];
  local?: ProductLocal;
  updatedAt?: string;
}

export function productToDoc(product: Product, meta: ProductDocMeta): ProductDoc {
  const { id, ...rest } = product;
  const skus = meta.skus ?? [product.sku];
  const doc: ProductDoc = {
    _id: id,
    ...rest,
    source: meta.source,
    hidden: meta.hidden ?? false,
    stockRank: stockRankOf(product.stock),
    search: buildSearchText(product, skus),
    skus,
    updatedAt: meta.updatedAt ?? new Date().toISOString(),
  };
  if (meta.retired) doc.retired = true;
  if (meta.supplier) doc.supplier = meta.supplier;
  if (meta.local && Object.keys(meta.local).length > 0) doc.local = meta.local;
  return doc;
}

/** Admin overrides win over whatever the supplier (or the demo generator) provided */
export function applyLocalOverrides(base: Product, local: ProductLocal | undefined): Product {
  if (!local) return base;
  const out: Product = { ...base };
  if (local.name) out.name = local.name;
  if (local.slug) out.slug = local.slug;
  if (typeof local.price === "number") out.price = local.price;
  else if (typeof local.markupPercent === "number" && local.markupPercent !== 0) {
    out.price = roundPrice(base.price * (1 + local.markupPercent / 100));
  }
  if (local.oldPrice === null) delete out.oldPrice;
  else if (typeof local.oldPrice === "number") out.oldPrice = local.oldPrice;
  if (out.oldPrice !== undefined && out.oldPrice <= out.price) delete out.oldPrice;
  if (local.stock) out.stock = local.stock;
  if (local.shortDescription !== undefined) out.shortDescription = local.shortDescription;
  if (local.description) out.description = local.description;
  if (local.specs) out.specs = local.specs;
  if (local.images) out.images = local.images;
  if (local.badges) out.badges = local.badges;
  if (local.categoryId) out.categoryId = local.categoryId;
  if (local.brandId) out.brandId = local.brandId;
  if (local.deliveryDays) out.deliveryDays = local.deliveryDays;
  if (typeof local.warrantyMonths === "number") out.warrantyMonths = local.warrantyMonths;
  if (typeof local.popularity === "number") out.popularity = local.popularity;
  if (local.oemNumbers) out.oemNumbers = local.oemNumbers;
  if (local.fitment) out.fitment = local.fitment;
  if (typeof local.universal === "boolean") out.universal = local.universal;
  return out;
}

/** Prices end on a "nice" number: ≥ 1000 → multiples of 10, ≥ 100 → multiples of 5 */
export function roundPrice(value: number, roundTo?: number): number {
  // tolerate floating-point noise such as 880.0000000000001
  const ceilTo = (v: number, step: number) => Math.ceil(v / step - 1e-9) * step;
  if (roundTo && roundTo > 1) return ceilTo(value, roundTo);
  if (value < 100) return ceilTo(value, 1);
  if (value < 1000) return ceilTo(value, 5);
  return ceilTo(value, 10);
}

export function activeSale(item: Pick<SupplierItem, "salePrice" | "saleStart" | "saleEnd" | "price">, today = new Date()): boolean {
  if (!item.salePrice || item.salePrice <= 0 || item.salePrice >= item.price) return false;
  const day = today.toISOString().slice(0, 10);
  if (item.saleStart && item.saleStart > day) return false;
  if (item.saleEnd && item.saleEnd < day) return false;
  return true;
}
