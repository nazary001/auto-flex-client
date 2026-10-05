import type { Db } from "mongodb";
import { brands } from "@/data/brands";
import { categories } from "@/data/categories";
import { makes, models } from "@/data/makes";
import { products } from "@/data/products";
import { reviews } from "@/data/reviews";
import type { Product } from "@/lib/types";
import { productToDoc } from "@/lib/server/catalog/product-doc";
import { recountTaxonomy, writeProductDocs } from "@/lib/server/catalog/products";
import { invalidateTaxonomy } from "@/lib/server/catalog/taxonomy-cache";
import { cols, type BrandDoc, type CategoryDoc, type MakeDoc, type ModelDoc } from "@/lib/server/db/collections";
import { nowIso } from "@/lib/server/db/util";

/*
 * Loads the static demo catalog (src/data) into the catalog collections. Used when the products
 * collection is empty and no supplier token is configured (development, tests, previews).
 */

export async function importDemoCatalog(db: Db): Promise<{ products: number }> {
  const c = cols(db);
  const now = nowIso();

  const categoryDocs: CategoryDoc[] = categories.map((cat, index) => ({
    _id: cat.id,
    slug: cat.slug,
    name: cat.name,
    parentId: cat.parentId,
    illustration: cat.illustration,
    ...(cat.icon ? { icon: cat.icon } : {}),
    ...(cat.description ? { description: cat.description } : {}),
    supplierIds: [],
    productCount: 0,
    sort: (index + 1) * 10,
    hidden: false,
    updatedAt: now,
  }));
  const brandDocs: BrandDoc[] = brands.map((b) => ({
    _id: b.id,
    slug: b.slug,
    name: b.name,
    country: b.country,
    description: b.description,
    ...(b.popular ? { popular: true } : {}),
    productCount: 0,
    hidden: false,
    updatedAt: now,
  }));
  const makeDocs: MakeDoc[] = makes.map((m) => ({
    _id: m.id,
    slug: m.slug,
    name: m.name,
    country: m.country,
    ...(m.popular ? { popular: true } : {}),
    productCount: 0,
    updatedAt: now,
  }));
  const modelDocs: ModelDoc[] = models.map((m) => ({
    _id: m.id,
    slug: m.slug,
    makeId: m.makeId,
    name: m.name,
    yearFrom: m.yearFrom,
    yearTo: m.yearTo,
    body: m.body,
    productCount: 0,
    supplierNames: [],
    updatedAt: now,
  }));

  const replaceAll = async <T extends { _id: string }>(
    collection: { bulkWrite: (ops: never[], o?: { ordered: boolean }) => Promise<unknown> },
    docs: T[],
  ) => {
    for (let i = 0; i < docs.length; i += 500) {
      await collection.bulkWrite(
        docs.slice(i, i + 500).map((doc) => {
          const { _id, ...rest } = doc;
          return { replaceOne: { filter: { _id }, replacement: rest, upsert: true } };
        }) as never[],
        { ordered: false },
      );
    }
  };
  await replaceAll(c.categories as never, categoryDocs);
  await replaceAll(c.brands as never, brandDocs);
  await replaceAll(c.makes as never, makeDocs);
  await replaceAll(c.models as never, modelDocs);

  const brandName = new Map(brands.map((b) => [b.id, b.name]));
  const categoryById = new Map(categories.map((cat) => [cat.id, cat]));
  const reviewsByProduct = new Map<string, { n: number; sum: number }>();
  for (const r of reviews) {
    const agg = reviewsByProduct.get(r.productId) ?? { n: 0, sum: 0 };
    agg.n++;
    agg.sum += r.rating;
    reviewsByProduct.set(r.productId, agg);
  }

  const docs = products.map((p) => {
    const category = categoryById.get(p.categoryId);
    const agg = reviewsByProduct.get(p.id);
    const product: Product = {
      ...p,
      brandName: brandName.get(p.brandId) ?? "",
      categoryName: category?.name ?? "",
      illustration: category?.illustration ?? "_fallback",
      groupId: category?.parentId ?? category?.id,
      rating: agg ? Math.round((agg.sum / agg.n) * 10) / 10 : 0,
      reviewsCount: agg?.n ?? 0,
    };
    return productToDoc(product, { source: "demo", updatedAt: now });
  });
  for (let i = 0; i < docs.length; i += 500) await writeProductDocs(db, docs.slice(i, i + 500));

  if ((await c.reviews.countDocuments({ source: "admin", status: "approved" })) === 0) {
    await c.reviews.bulkWrite(
      reviews.map((r) => ({
        replaceOne: {
          filter: { _id: `demo-${r.id}` },
          replacement: {
            productId: r.productId,
            author: r.author,
            rating: r.rating,
            date: r.date,
            text: r.text,
            ...(r.car ? { car: r.car } : {}),
            status: "approved" as const,
            source: "admin" as const,
            createdAt: `${r.date}T10:00:00.000Z`,
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }

  await recountTaxonomy(db);
  invalidateTaxonomy();
  return { products: docs.length };
}
