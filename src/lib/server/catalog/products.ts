import type { AnyBulkWriteOperation, Db } from "mongodb";
import type { Product } from "@/lib/types";
import { cols, type ProductDoc, type ProductLocal } from "@/lib/server/db/collections";
import { nowIso } from "@/lib/server/db/util";
import { applyLocalOverrides, docToProduct, productToDoc } from "./product-doc";
import { invalidateTaxonomy } from "./taxonomy-cache";

/*
 * Write side of the products collection (sync, demo import, admin). Reads for the storefront
 * live in queries.ts; the admin reads documents directly through getProductDoc*.
 */

export async function getProductDoc(db: Db, id: string): Promise<ProductDoc | null> {
  return cols(db).products.findOne({ _id: id });
}

export async function getProductDocBySlug(db: Db, slug: string): Promise<ProductDoc | null> {
  return cols(db).products.findOne({ slug });
}

export async function getProductDocs(db: Db, ids: string[]): Promise<ProductDoc[]> {
  if (ids.length === 0) return [];
  return cols(db).products.find({ _id: { $in: ids } }).toArray();
}

/** createdAt / local / hidden of existing documents, so a sync keeps admin decisions */
export async function existingProductMeta(
  db: Db,
  ids: string[],
): Promise<Map<string, Pick<ProductDoc, "createdAt" | "local" | "hidden" | "retired" | "slug" | "rating" | "reviewsCount" | "popularity">>> {
  if (ids.length === 0) return new Map();
  const docs = await cols(db)
    .products.find(
      { _id: { $in: ids } },
      { projection: { createdAt: 1, local: 1, hidden: 1, retired: 1, slug: 1, rating: 1, reviewsCount: 1, popularity: 1 } },
    )
    .toArray();
  return new Map(docs.map((d) => [d._id, d]));
}

/** Replace documents in bulk (unordered). Returns the number written. */
export async function writeProductDocs(db: Db, docs: ProductDoc[]): Promise<number> {
  if (docs.length === 0) return 0;
  const ops: AnyBulkWriteOperation<ProductDoc>[] = docs.map((doc) => {
    const { _id, ...rest } = doc;
    return { replaceOne: { filter: { _id }, replacement: rest, upsert: true } };
  });
  const result = await cols(db).products.bulkWrite(ops, { ordered: false });
  return result.upsertedCount + result.modifiedCount + result.matchedCount;
}

/** Stores a manual product (admin-created) or replaces an existing one keeping its source */
export async function saveProduct(db: Db, product: Product, meta: { source?: ProductDoc["source"]; hidden?: boolean }): Promise<ProductDoc> {
  const existing = await getProductDoc(db, product.id);
  const doc = productToDoc(product, {
    source: meta.source ?? existing?.source ?? "manual",
    hidden: meta.hidden ?? existing?.hidden ?? false,
    retired: existing?.retired,
    supplier: existing?.supplier,
    local: existing?.local,
    skus: existing?.skus ?? [product.sku],
  });
  if (existing?.createdAt) doc.createdAt = existing.createdAt;
  await writeProductDocs(db, [doc]);
  return doc;
}

/**
 * Admin edit of a supplier product: merge the override into `local`, recompute the effective
 * product from the stored base (`baseOf(doc)`) and write it back.
 */
export async function setProductLocal(
  db: Db,
  id: string,
  patch: ProductLocal | null,
  baseOf: (doc: ProductDoc) => Product,
): Promise<ProductDoc | null> {
  const doc = await getProductDoc(db, id);
  if (!doc) return null;
  const local: ProductLocal | undefined = patch === null ? undefined : { ...(doc.local ?? {}), ...patch };
  if (local) for (const key of Object.keys(local) as (keyof ProductLocal)[]) if (local[key] === undefined) delete local[key];
  const effective = applyLocalOverrides(baseOf(doc), local && Object.keys(local).length ? local : undefined);
  const next = productToDoc(effective, {
    source: doc.source,
    hidden: doc.hidden,
    retired: doc.retired,
    supplier: doc.supplier,
    local: local && Object.keys(local).length ? local : undefined,
    skus: doc.skus,
  });
  next.createdAt = doc.createdAt;
  next.rating = doc.rating;
  next.reviewsCount = doc.reviewsCount;
  await writeProductDocs(db, [next]);
  return next;
}

export async function setProductHidden(db: Db, id: string, hidden: boolean): Promise<void> {
  await cols(db).products.updateOne({ _id: id }, { $set: { hidden, updatedAt: nowIso() } });
}

export async function setProductsHidden(db: Db, ids: string[], hidden: boolean): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await cols(db).products.updateMany({ _id: { $in: ids } }, { $set: { hidden, updatedAt: nowIso() } });
  return result.modifiedCount;
}

export async function deleteProduct(db: Db, id: string): Promise<boolean> {
  const result = await cols(db).products.deleteOne({ _id: id });
  return result.deletedCount === 1;
}

export async function countProducts(db: Db, filter: Record<string, unknown> = {}): Promise<number> {
  return cols(db).products.countDocuments(filter);
}

/** Recalculates the stored rating / review counter of a product from its approved reviews */
export async function recomputeProductRating(db: Db, productId: string): Promise<void> {
  const [row] = await cols(db)
    .reviews.aggregate<{ n: number; avg: number }>([
      { $match: { productId, status: "approved" } },
      { $group: { _id: null, n: { $sum: 1 }, avg: { $avg: "$rating" } } },
    ])
    .toArray();
  await cols(db).products.updateOne(
    { _id: productId },
    { $set: { reviewsCount: row?.n ?? 0, rating: row ? Math.round(row.avg * 10) / 10 : 0 } },
  );
}

/** Refreshes productCount on categories, brands, makes and models from the visible products */
export async function recountTaxonomy(db: Db): Promise<void> {
  const c = cols(db);
  const visible = { hidden: false };
  const [byLeaf, byGroup, byBrand, byMake, byModel] = await Promise.all([
    c.products.aggregate<{ _id: string; n: number }>([{ $match: visible }, { $group: { _id: "$categoryId", n: { $sum: 1 } } }]).toArray(),
    c.products.aggregate<{ _id: string; n: number }>([{ $match: visible }, { $group: { _id: "$groupId", n: { $sum: 1 } } }]).toArray(),
    c.products.aggregate<{ _id: string; n: number }>([{ $match: visible }, { $group: { _id: "$brandId", n: { $sum: 1 } } }]).toArray(),
    c.products
      .aggregate<{ _id: string; n: number }>([
        { $match: visible },
        { $unwind: "$fitment" },
        { $group: { _id: { p: "$_id", m: "$fitment.makeId" } } },
        { $group: { _id: "$_id.m", n: { $sum: 1 } } },
      ])
      .toArray(),
    c.products
      .aggregate<{ _id: string; n: number }>([
        { $match: visible },
        { $unwind: "$fitment" },
        { $group: { _id: { p: "$_id", m: "$fitment.modelId" } } },
        { $group: { _id: "$_id.m", n: { $sum: 1 } } },
      ])
      .toArray(),
  ]);
  const now = nowIso();
  const apply = async <T extends { _id: string }>(
    collection: { bulkWrite: (ops: AnyBulkWriteOperation<T>[], o?: { ordered: boolean }) => Promise<unknown>; updateMany: (f: Record<string, unknown>, u: Record<string, unknown>) => Promise<unknown> },
    rows: { _id: string; n: number }[],
  ) => {
    const ids = rows.map((r) => r._id).filter(Boolean);
    await collection.updateMany({ _id: { $nin: ids } }, { $set: { productCount: 0, updatedAt: now } });
    if (rows.length === 0) return;
    await collection.bulkWrite(
      rows
        .filter((r) => r._id)
        .map((r) => ({ updateOne: { filter: { _id: r._id } as never, update: { $set: { productCount: r.n, updatedAt: now } } as never } })),
      { ordered: false },
    );
  };
  await apply(c.categories as never, [...byLeaf, ...byGroup]);
  await apply(c.brands as never, byBrand);
  await apply(c.makes as never, byMake);
  await apply(c.models as never, byModel);
  invalidateTaxonomy();
}

export { docToProduct };
