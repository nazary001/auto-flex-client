import type { Db, Filter } from "mongodb";
import type { OfferAvailability, OfferListFilter, Page, Paging, SupplierOffer } from "@/lib/admin/types";
import { cols, type SupplierOfferDoc } from "../collections";
import { compact, containsRegex, fromDoc, newId, nowIso, paginate } from "../util";

/*
 * Supplier price lists: one row per (supplier, SKU). The best offer for a product drives the
 * suggested supplier and cost price of an order line.
 */

const toOffer = (doc: SupplierOfferDoc): SupplierOffer => fromDoc<SupplierOffer>(doc);

/** Part numbers are compared without spaces, dots and hyphens, upper-cased */
export function normalizeSku(sku: string): string {
  return sku.replace(/[\s.\-]/g, "").toUpperCase();
}

const availabilityRank: Record<OfferAvailability, number> = { in_stock: 0, on_order: 1, none: 2 };

export function rankOffers(offers: SupplierOffer[]): SupplierOffer[] {
  return [...offers].sort(
    (a, b) => availabilityRank[a.availability] - availabilityRank[b.availability] || a.cost - b.cost,
  );
}

export interface OfferInput {
  sku: string;
  productId?: string | null;
  cost: number;
  availability: OfferAvailability;
  qty?: number;
  leadDays?: [number, number];
}

/** Insert-or-update by (supplierId, sku). Returns how many rows were created vs. updated. */
export async function upsertOffers(
  db: Db,
  supplierId: string,
  rows: OfferInput[],
): Promise<{ inserted: number; updated: number }> {
  if (rows.length === 0) return { inserted: 0, updated: 0 };
  const now = nowIso();
  const result = await cols(db).offers.bulkWrite(
    rows.map((row) => {
      const sku = normalizeSku(row.sku);
      return {
        updateOne: {
          filter: { supplierId, sku },
          update: {
            $set: compact({
              cost: Math.round(row.cost),
              availability: row.availability,
              qty: row.qty,
              leadDays: row.leadDays,
              productId: row.productId ?? null,
              updatedAt: now,
            }),
            $setOnInsert: { _id: newId(), supplierId, sku },
          },
          upsert: true,
        },
      };
    }),
    { ordered: false },
  );
  return { inserted: result.upsertedCount, updated: result.modifiedCount };
}

export async function deleteOffer(db: Db, id: string): Promise<void> {
  await cols(db).offers.deleteOne({ _id: id });
}

/** Removes the offers of the given supplier SKUs (lines the supplier no longer prices) */
export async function deleteOffersBySku(db: Db, supplierId: string, skus: string[]): Promise<number> {
  if (skus.length === 0) return 0;
  const result = await cols(db).offers.deleteMany({ supplierId, sku: { $in: skus.map(normalizeSku) } });
  return result.deletedCount;
}

export async function deleteSupplierOffers(db: Db, supplierId: string): Promise<number> {
  const result = await cols(db).offers.deleteMany({ supplierId });
  return result.deletedCount;
}

export async function getOffer(db: Db, id: string): Promise<SupplierOffer | null> {
  const doc = await cols(db).offers.findOne({ _id: id });
  return doc ? toOffer(doc) : null;
}

export async function listOffers(db: Db, filter: OfferListFilter, paging: Paging): Promise<Page<SupplierOffer>> {
  const query: Filter<SupplierOfferDoc> = {};
  if (filter.supplierId) query.supplierId = filter.supplierId;
  if (filter.productId) query.productId = filter.productId;
  if (filter.sku) query.sku = normalizeSku(filter.sku);
  if (filter.availability?.length) query.availability = { $in: filter.availability };
  if (filter.q?.trim()) query.sku = containsRegex(normalizeSku(filter.q));
  return paginate(cols(db).offers, query, { sku: 1, cost: 1 }, paging, toOffer);
}

export async function countOffersBySupplier(db: Db): Promise<Map<string, number>> {
  const rows = await cols(db)
    .offers.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$supplierId", n: { $sum: 1 } } }])
    .toArray();
  return new Map(rows.map((r) => [r._id, r.n]));
}

/** All offers for one product (by catalog id or SKU), best first */
export async function offersForProduct(
  db: Db,
  key: { productId?: string | null; sku?: string },
  options: { activeSuppliersOnly?: boolean } = {},
): Promise<SupplierOffer[]> {
  const or: Filter<SupplierOfferDoc>[] = [];
  if (key.productId) or.push({ productId: key.productId });
  if (key.sku) or.push({ sku: normalizeSku(key.sku) });
  if (or.length === 0) return [];
  let docs = await cols(db).offers.find({ $or: or }).toArray();
  if (options.activeSuppliersOnly !== false) {
    const active = new Set(
      (await cols(db).suppliers.find({ active: true }, { projection: { _id: 1 } }).toArray()).map((s) => s._id),
    );
    docs = docs.filter((d) => active.has(d.supplierId));
  }
  return rankOffers(docs.map(toOffer));
}

export async function bestOfferFor(db: Db, key: { productId?: string | null; sku?: string }): Promise<SupplierOffer | null> {
  const offers = await offersForProduct(db, key);
  const usable = offers.filter((o) => o.availability !== "none");
  return usable[0] ?? offers[0] ?? null;
}

/** Offers for many products at once: Map keyed by productId and by normalised SKU */
export async function offersForMany(
  db: Db,
  keys: { productId?: string | null; sku?: string }[],
): Promise<Map<string, SupplierOffer[]>> {
  const productIds = keys.map((k) => k.productId).filter((v): v is string => Boolean(v));
  const skus = keys.map((k) => (k.sku ? normalizeSku(k.sku) : "")).filter(Boolean);
  if (productIds.length === 0 && skus.length === 0) return new Map();
  const or: Filter<SupplierOfferDoc>[] = [];
  if (productIds.length) or.push({ productId: { $in: productIds } });
  if (skus.length) or.push({ sku: { $in: skus } });
  const active = new Set(
    (await cols(db).suppliers.find({ active: true }, { projection: { _id: 1 } }).toArray()).map((s) => s._id),
  );
  const docs = (await cols(db).offers.find({ $or: or }).toArray()).filter((d) => active.has(d.supplierId));
  const out = new Map<string, SupplierOffer[]>();
  for (const doc of docs) {
    const offer = toOffer(doc);
    for (const key of [offer.productId, offer.sku]) {
      if (!key) continue;
      const list = out.get(key) ?? [];
      list.push(offer);
      out.set(key, list);
    }
  }
  for (const [key, list] of out) out.set(key, rankOffers(list));
  return out;
}

/** Products that have no offer from any active supplier */
export async function countProductsWithOffers(db: Db): Promise<number> {
  const ids = await cols(db).offers.distinct("productId", { productId: { $ne: null } });
  return ids.length;
}
