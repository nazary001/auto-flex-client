import type { Db, Document, Filter, Sort } from "mongodb";
import type { Brand, Category, FacetCount, Product, ProductQuery, ProductQueryResult, Review } from "@/lib/types";
import { fold, normalizeCode, tokenize } from "@/lib/slug";
import { cols, type ProductDoc } from "@/lib/server/db/collections";
import { docToProduct } from "./product-doc";
import { getTaxonomy, type Taxonomy } from "./taxonomy-cache";

/*
 * Storefront reads over the products collection. Every query is restricted to visible products
 * (`hidden: false`); facets are computed with small aggregations run in parallel.
 */

const VISIBLE: Filter<ProductDoc> = { hidden: false };

export async function getProductBySlug(db: Db, slug: string): Promise<Product | null> {
  const doc = await cols(db).products.findOne({ ...VISIBLE, slug });
  return doc ? docToProduct(doc) : null;
}

export async function getProductById(db: Db, id: string): Promise<Product | null> {
  const doc = await cols(db).products.findOne({ ...VISIBLE, _id: id });
  return doc ? docToProduct(doc) : null;
}

export async function getProductsByIds(db: Db, ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const docs = await cols(db).products.find({ ...VISIBLE, _id: { $in: ids } }).toArray();
  const byId = new Map(docs.map((d) => [d._id, docToProduct(d)]));
  return ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
}

export async function countVisibleProducts(db: Db): Promise<number> {
  return cols(db).products.countDocuments(VISIBLE);
}

export async function listProductSlugs(db: Db, offset: number, limit: number): Promise<{ slug: string; updatedAt: string }[]> {
  const docs = await cols(db)
    .products.find(VISIBLE, { projection: { slug: 1, updatedAt: 1 }, sort: { _id: 1 }, skip: offset, limit })
    .toArray();
  return docs.map((d) => ({ slug: d.slug, updatedAt: d.updatedAt }));
}

// ── listing ─────────────────────────────────────────────────

type SkipKey = "category" | "brand" | "vehicle" | "price" | "stock" | "badge" | "q";

function buildMatch(query: ProductQuery, tax: Taxonomy, skip: ReadonlySet<SkipKey>): Filter<ProductDoc> {
  const match: Filter<ProductDoc> = { ...VISIBLE };
  const and: Filter<ProductDoc>[] = [];
  if (!skip.has("category") && query.categoryId) {
    const category = tax.categoryById.get(query.categoryId);
    if (!category) match._id = "__none__";
    else if (category.parentId === null) match.groupId = category.id;
    else match.categoryId = category.id;
  }
  if (!skip.has("brand") && query.brandIds && query.brandIds.length > 0) match.brandId = { $in: query.brandIds };
  if (!skip.has("vehicle") && (query.makeId || query.modelId)) {
    const vehicle: Filter<ProductDoc> = query.modelId ? { "fitment.modelId": query.modelId } : { "fitment.makeId": query.makeId };
    and.push(query.includeUniversal ? { $or: [vehicle, { universal: true }] } : vehicle);
  }
  if (!skip.has("price")) {
    const price: { $gte?: number; $lte?: number } = {};
    if (query.priceMin != null) price.$gte = query.priceMin;
    if (query.priceMax != null) price.$lte = query.priceMax;
    if (price.$gte !== undefined || price.$lte !== undefined) match.price = price;
  }
  if (!skip.has("stock") && query.inStockOnly) match.stockRank = { $lte: 1 };
  if (!skip.has("badge") && query.badge) match.badges = query.badge;
  if (!skip.has("q") && query.q && query.q.trim().length >= 2) {
    const q = query.q.trim();
    const code = normalizeCode(q);
    // a part number wins; otherwise every word must be present in the folded text
    and.push({ $or: [{ search: { $regex: `(^|\\s)${escapeRegex(code)}`, $options: "i" } }, { $text: { $search: tokenize(q).join(" ") } }] });
  }
  if (and.length) match.$and = and;
  return match;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortFor(sort: ProductQuery["sort"]): Sort {
  switch (sort) {
    case "price_asc":
      return { sinks: 1, price: 1, _id: 1 };
    case "price_desc":
      return { sinks: 1, price: -1, _id: 1 };
    case "new":
      return { sinks: 1, createdAt: -1, popularity: -1, _id: 1 };
    case "rating":
      return { sinks: 1, rating: -1, reviewsCount: -1, _id: 1 };
    default:
      return { sinks: 1, popularity: -1, _id: 1 };
  }
}

function hasText(match: Filter<ProductDoc>): boolean {
  return JSON.stringify(match).includes('"$text"');
}

/**
 * `$text` is only allowed in the first stage and cannot sit inside `$or` with non-text clauses;
 * for free-text queries we therefore resolve the matching ids first and continue with `_id: $in`.
 */
async function resolveTextMatch(db: Db, match: Filter<ProductDoc>): Promise<Filter<ProductDoc>> {
  if (!hasText(match)) return match;
  const and = (match.$and ?? []) as Filter<ProductDoc>[];
  const textClause = and.find((clause) => JSON.stringify(clause).includes('"$text"'));
  if (!textClause) return match;
  const rest = and.filter((clause) => clause !== textClause);
  const [regexClause, textOnly] = (textClause.$or ?? []) as Filter<ProductDoc>[];
  const base: Filter<ProductDoc> = { ...match, $and: rest.length ? rest : undefined };
  delete (base as Record<string, unknown>).$and;
  if (rest.length) base.$and = rest;
  const [codeIds, textIds] = await Promise.all([
    cols(db).products.find({ ...base, ...regexClause }, { projection: { _id: 1 }, limit: 5000 }).toArray(),
    cols(db).products.find({ ...base, ...textOnly }, { projection: { _id: 1 }, limit: 5000 }).toArray(),
  ]);
  const ids = [...new Set([...codeIds.map((d) => d._id), ...textIds.map((d) => d._id)])];
  return { ...base, _id: { $in: ids } };
}

export async function queryProducts(db: Db, query: ProductQuery): Promise<ProductQueryResult> {
  const tax = await getTaxonomy();
  const products = cols(db).products;
  const noSkip: ReadonlySet<SkipKey> = new Set();
  const [match, matchNoBrand, matchNoPrice, matchNoStock] = await Promise.all([
    resolveTextMatch(db, buildMatch(query, tax, noSkip)),
    resolveTextMatch(db, buildMatch(query, tax, new Set<SkipKey>(["brand"]))),
    resolveTextMatch(db, buildMatch(query, tax, new Set<SkipKey>(["price"]))),
    resolveTextMatch(db, buildMatch(query, tax, new Set<SkipKey>(["stock"]))),
  ]);

  const perPage = query.perPage && query.perPage > 0 ? query.perPage : 24;
  const requestedPage = Math.max(query.page ?? 1, 1);

  const [total, brandRows, categoryRows, priceRows, inStockCount] = await Promise.all([
    products.countDocuments(match),
    products.aggregate<{ _id: string; n: number }>([{ $match: matchNoBrand }, { $group: { _id: "$brandId", n: { $sum: 1 } } }]).toArray(),
    products.aggregate<{ _id: string; n: number }>([{ $match: match }, { $group: { _id: "$categoryId", n: { $sum: 1 } } }]).toArray(),
    products.aggregate<{ min: number; max: number }>([{ $match: matchNoPrice }, { $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } }]).toArray(),
    products.countDocuments({ ...matchNoStock, stockRank: { $lte: 1 } }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(requestedPage, pageCount);
  const pipeline: Document[] = [
    { $match: match },
    { $addFields: { sinks: { $cond: [{ $eq: ["$stock", "out_of_stock"] }, 1, 0] } } },
    { $sort: sortFor(query.sort) },
    { $skip: (page - 1) * perPage },
    { $limit: perPage },
  ];
  const docs = await products.aggregate<ProductDoc>(pipeline).toArray();

  const brands: FacetCount<Brand>[] = [];
  for (const row of brandRows) {
    const brand = tax.brandById.get(row._id);
    if (brand) brands.push({ item: brand, count: row.n });
  }
  brands.sort((a, b) => b.count - a.count || a.item.name.localeCompare(b.item.name, "uk"));

  const categories: FacetCount<Category>[] = [];
  for (const row of categoryRows) {
    const category = tax.categoryById.get(row._id);
    if (category) categories.push({ item: category, count: row.n });
  }
  categories.sort((a, b) => b.count - a.count || (tax.categoryIndex.get(a.item.id) ?? 0) - (tax.categoryIndex.get(b.item.id) ?? 0));

  const priceRange: [number, number] = priceRows[0] ? [priceRows[0].min, priceRows[0].max] : [0, 0];

  return {
    items: docs.map(docToProduct),
    total,
    page,
    perPage,
    pageCount,
    facets: { brands, categories, priceRange, inStockCount },
  };
}

// ── curated lists ───────────────────────────────────────────

const inStockSort: Sort = { stockRank: 1, popularity: -1, _id: 1 };

export async function getNewProducts(db: Db, limit: number): Promise<Product[]> {
  const docs = await cols(db)
    .products.find({ ...VISIBLE, stock: { $ne: "out_of_stock" } })
    .sort({ createdAt: -1, popularity: -1, _id: 1 })
    .limit(limit)
    .toArray();
  return docs.map(docToProduct);
}

export async function getSaleProducts(db: Db, limit: number): Promise<Product[]> {
  const docs = await cols(db)
    .products.aggregate<ProductDoc>([
      { $match: { ...VISIBLE, stock: { $ne: "out_of_stock" }, oldPrice: { $gt: 0 } } },
      { $addFields: { discount: { $divide: [{ $subtract: ["$oldPrice", "$price"] }, "$oldPrice"] } } },
      { $match: { discount: { $gt: 0 } } },
      { $sort: { discount: -1, popularity: -1, _id: 1 } },
      { $limit: limit },
    ])
    .toArray();
  return docs.map(docToProduct);
}

export async function getPopularProducts(db: Db, limit: number): Promise<Product[]> {
  const docs = await cols(db)
    .products.find({ ...VISIBLE, stock: { $ne: "out_of_stock" } })
    .sort(inStockSort)
    .limit(limit)
    .toArray();
  return docs.map(docToProduct);
}

export async function getRelatedProducts(db: Db, product: Product, limit: number): Promise<Product[]> {
  const fitModels = new Set(product.fitment.map((f) => f.modelId));
  const sameLeaf = await cols(db)
    .products.find({ ...VISIBLE, categoryId: product.categoryId, _id: { $ne: product.id } })
    .sort(inStockSort)
    .limit(Math.max(limit * 4, 24))
    .toArray();
  const ranked = sameLeaf
    .map(docToProduct)
    .sort((a, b) => Number(b.fitment.some((f) => fitModels.has(f.modelId))) - Number(a.fitment.some((f) => fitModels.has(f.modelId))) || b.popularity - a.popularity);
  if (ranked.length >= limit || !product.groupId) return ranked.slice(0, limit);
  const seen = new Set([product.id, ...ranked.map((p) => p.id)]);
  const sameGroup = await cols(db)
    .products.find({ ...VISIBLE, groupId: product.groupId, _id: { $nin: [...seen] } })
    .sort(inStockSort)
    .limit(limit)
    .toArray();
  return [...ranked, ...sameGroup.map(docToProduct)].slice(0, limit);
}

// ── vehicle → categories ────────────────────────────────────

export async function getCategoriesForVehicle(db: Db, makeId: string, modelId?: string): Promise<FacetCount<Category>[]> {
  const tax = await getTaxonomy();
  const rows = await cols(db)
    .products.aggregate<{ _id: string; n: number }>([
      { $match: { ...VISIBLE, universal: false, ...(modelId ? { "fitment.modelId": modelId } : { "fitment.makeId": makeId }) } },
      { $group: { _id: "$categoryId", n: { $sum: 1 } } },
    ])
    .toArray();
  const out: FacetCount<Category>[] = [];
  for (const row of rows) {
    const category = tax.categoryById.get(row._id);
    if (category && category.parentId !== null) out.push({ item: category, count: row.n });
  }
  return out.sort((a, b) => (tax.categoryIndex.get(a.item.id) ?? 0) - (tax.categoryIndex.get(b.item.id) ?? 0));
}

// ── reviews ─────────────────────────────────────────────────

export async function getApprovedReviews(db: Db, productId: string): Promise<Review[]> {
  const docs = await cols(db).reviews.find({ productId, status: "approved" }).sort({ date: -1 }).toArray();
  return docs.map((d) => ({
    id: d._id,
    productId: d.productId,
    author: d.author,
    rating: d.rating,
    date: d.date,
    text: d.text,
    ...(d.car ? { car: d.car } : {}),
  }));
}

// ── search ──────────────────────────────────────────────────

export async function searchCatalog(
  db: Db,
  q: string,
  limit = 8,
): Promise<{ products: Product[]; categories: Category[]; brands: Brand[]; total: number }> {
  const query = q.trim();
  if (query.length < 2) return { products: [], categories: [], brands: [], total: 0 };
  const tax = await getTaxonomy();
  const tokens = tokenize(query);
  const code = normalizeCode(query);
  const products = cols(db).products;

  const codeFilter: Filter<ProductDoc> = { ...VISIBLE, search: { $regex: `(^|\\s)${escapeRegex(code)}`, $options: "i" } };
  const textFilter: Filter<ProductDoc> = { ...VISIBLE, $text: { $search: tokens.join(" ") } };

  const [codeDocs, textDocs, codeTotal, textTotal] = await Promise.all([
    code.length >= 2 ? products.find(codeFilter).sort(inStockSort).limit(limit).toArray() : Promise.resolve([] as ProductDoc[]),
    tokens.length
      ? products
          .find(textFilter, { projection: { score: { $meta: "textScore" } } })
          .sort({ score: { $meta: "textScore" }, stockRank: 1, popularity: -1 })
          .limit(limit)
          .toArray()
      : Promise.resolve([] as ProductDoc[]),
    code.length >= 2 ? products.countDocuments(codeFilter) : Promise.resolve(0),
    tokens.length ? products.countDocuments(textFilter) : Promise.resolve(0),
  ]);

  const seen = new Set<string>();
  const merged: Product[] = [];
  for (const doc of [...codeDocs, ...textDocs]) {
    if (seen.has(doc._id)) continue;
    seen.add(doc._id);
    merged.push(docToProduct(doc));
  }

  const matchesAllTokens = (name: string) => {
    const folded = fold(name);
    return tokens.every((t) => folded.includes(t));
  };
  const categories = tax.categories.filter((c) => matchesAllTokens(c.name)).slice(0, limit);
  const brands = tax.brands.filter((b) => matchesAllTokens(b.name)).slice(0, limit);

  return { products: merged.slice(0, limit), categories, brands, total: Math.max(codeTotal, textTotal, merged.length) };
}
