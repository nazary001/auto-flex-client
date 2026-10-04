import { brands } from "@/data/brands";
import { categories } from "@/data/categories";
import { makes, models } from "@/data/makes";
import { products } from "@/data/products";
import { reviews } from "@/data/reviews";
import type {
  Brand,
  CarModel,
  Category,
  FacetCount,
  Make,
  Product,
  ProductQuery,
  ProductQueryResult,
  Review,
} from "@/lib/types";

/*
 * Read-only query layer over the static catalog arrays. Pure synchronous
 * functions; lookup maps are built once at module load. No Node-only APIs, so
 * this module is safe to import from Server Components and route handlers.
 */

const EN_DASH = "–";

// ── category lookups ────────────────────────────────────────
const categoryById = new Map(categories.map((c) => [c.id, c]));
const categoryIndex = new Map(categories.map((c, i) => [c.id, i]));
const childrenByParent = new Map<string, Category[]>();
for (const c of categories) {
  if (c.parentId) {
    const list = childrenByParent.get(c.parentId) ?? [];
    list.push(c);
    childrenByParent.set(c.parentId, list);
  }
}
const topCategories = categories.filter((c) => c.parentId === null);
const leafCategories = categories.filter((c) => c.parentId !== null);

/** For every category id, the set of leaf categories it covers (itself if it is a leaf). */
const descendantLeaves = new Map<string, Set<string>>();
for (const c of categories) {
  if (c.parentId === null) {
    descendantLeaves.set(c.id, new Set((childrenByParent.get(c.id) ?? []).map((ch) => ch.id)));
  } else {
    descendantLeaves.set(c.id, new Set([c.id]));
  }
}

// ── brand / make / model lookups ────────────────────────────
const brandById = new Map(brands.map((b) => [b.id, b]));
const brandsSorted = [...brands].sort((a, b) => a.name.localeCompare(b.name, "uk"));

const makeById = new Map(makes.map((m) => [m.id, m]));
const makesSorted = [...makes].sort((a, b) => a.name.localeCompare(b.name, "uk"));
const modelById = new Map(models.map((m) => [m.id, m]));
const modelsByMake = new Map<string, CarModel[]>();
for (const m of models) {
  const list = modelsByMake.get(m.makeId) ?? [];
  list.push(m);
  modelsByMake.set(m.makeId, list);
}
for (const [, list] of modelsByMake) list.sort((a, b) => a.name.localeCompare(b.name, "uk"));

// ── product / review lookups ────────────────────────────────
const productById = new Map(products.map((p) => [p.id, p]));
const productBySlug = new Map(products.map((p) => [p.slug, p]));

const reviewsByProduct = new Map<string, Review[]>();
for (const r of reviews) {
  const list = reviewsByProduct.get(r.productId) ?? [];
  list.push(r);
  reviewsByProduct.set(r.productId, list);
}
for (const [, list] of reviewsByProduct) list.sort((a, b) => b.date.localeCompare(a.date));

// The rating and the review counter shown across the site are derived from the written
// reviews, so «N відгуків» on a card always equals the list on the product page.
for (const p of products) {
  const list = reviewsByProduct.get(p.id) ?? [];
  p.reviewsCount = list.length;
  p.rating = list.length > 0 ? Math.round((list.reduce((sum, r) => sum + r.rating, 0) / list.length) * 10) / 10 : 0;
}

// ── search metadata ─────────────────────────────────────────
/** Part numbers are compared without spaces, dots and hyphens */
const normalizeCode = (s: string) => s.toLowerCase().replace(/[\s.\-]/g, "");

/** Lowercase and strip diacritics, so "skoda" finds "Škoda" and "citroen" finds "Citroën" */
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’ʼ`]/g, "'");

const tokenize = (q: string) => fold(q).split(/\s+/).filter(Boolean);

interface SearchMeta {
  /** Folded name + brand + category + fitted vehicles */
  text: string;
  /** Folded words of the product name, for prefix ranking */
  nameWords: string[];
  skuNorm: string;
  oeNorm: string[];
}
const searchMeta = new Map<string, SearchMeta>();
for (const p of products) {
  const brand = brandById.get(p.brandId);
  const category = categoryById.get(p.categoryId);
  const fitmentText = p.fitment
    .map((f) => {
      const make = makeById.get(f.makeId);
      const model = modelById.get(f.modelId);
      return make && model ? `${make.name} ${model.name}` : "";
    })
    .join(" ");
  searchMeta.set(p.id, {
    text: fold(`${p.name} ${brand?.name ?? ""} ${category?.name ?? ""} ${fitmentText}`),
    nameWords: fold(p.name).split(/\s+/),
    skuNorm: normalizeCode(p.sku),
    oeNorm: p.oemNumbers.map(normalizeCode),
  });
}

/**
 * Relevance of a product for a free-text query, 0 = no match.
 * A part number (typed with any spacing) wins; otherwise EVERY word of the query must be
 * found in the product text or inside its part numbers.
 */
function searchScore(meta: SearchMeta, tokens: string[], code: string): number {
  if (code.length >= 2) {
    if (meta.skuNorm === code || meta.oeNorm.includes(code)) return 100;
    if (meta.skuNorm.startsWith(code)) return 80;
    if (meta.oeNorm.some((o) => o.startsWith(code))) return 70;
  }
  const inCodes = (value: string) =>
    value.length >= 3 && (meta.skuNorm.includes(value) || meta.oeNorm.some((o) => o.includes(value)));
  if (tokens.length > 0 && tokens.every((t) => meta.text.includes(t) || inCodes(normalizeCode(t)))) {
    return tokens.every((t) => meta.nameWords.some((w) => w.startsWith(t))) ? 60 : 45;
  }
  return inCodes(code) ? 30 : 0;
}

// ── precomputed counts ──────────────────────────────────────
const leafProductCount = new Map<string, number>();
for (const p of products) leafProductCount.set(p.categoryId, (leafProductCount.get(p.categoryId) ?? 0) + 1);

const categoryProductCount = new Map<string, number>();
for (const c of categories) {
  let total = 0;
  for (const leafId of descendantLeaves.get(c.id) ?? []) total += leafProductCount.get(leafId) ?? 0;
  categoryProductCount.set(c.id, total);
}

const brandProductCount = new Map<string, number>();
for (const p of products) brandProductCount.set(p.brandId, (brandProductCount.get(p.brandId) ?? 0) + 1);

const makeProductCount = new Map<string, number>();
const modelProductCount = new Map<string, number>();
for (const p of products) {
  const seenMakes = new Set<string>();
  const seenModels = new Set<string>();
  for (const f of p.fitment) {
    seenMakes.add(f.makeId);
    seenModels.add(f.modelId);
  }
  for (const id of seenMakes) makeProductCount.set(id, (makeProductCount.get(id) ?? 0) + 1);
  for (const id of seenModels) modelProductCount.set(id, (modelProductCount.get(id) ?? 0) + 1);
}

// ── categories ──────────────────────────────────────────────
export function getCategories(): Category[] {
  return categories;
}
export function getTopCategories(): Category[] {
  return topCategories;
}
export function getCategory(slug: string): Category | undefined {
  return categoryById.get(slug);
}
export function getSubcategories(parentId: string): Category[] {
  return childrenByParent.get(parentId) ?? [];
}
export function getCategoryPath(category: Category): Category[] {
  const path: Category[] = [category];
  let current = category;
  while (current.parentId) {
    const parent = categoryById.get(current.parentId);
    if (!parent) break;
    path.unshift(parent);
    current = parent;
  }
  return path;
}
export function getCategoryProductCount(categoryId: string): number {
  return categoryProductCount.get(categoryId) ?? 0;
}

// ── brands ──────────────────────────────────────────────────
export function getBrands(): Brand[] {
  return brandsSorted;
}
export function getBrand(slug: string): Brand | undefined {
  return brandById.get(slug);
}
export function getBrandById(id: string): Brand | undefined {
  return brandById.get(id);
}
export function getBrandProductCount(brandId: string): number {
  return brandProductCount.get(brandId) ?? 0;
}

// ── makes & models ──────────────────────────────────────────
export function getMakes(): Make[] {
  return makesSorted;
}
export function getMake(slug: string): Make | undefined {
  return makeById.get(slug);
}
export function getMakeById(id: string): Make | undefined {
  return makeById.get(id);
}
export function getModels(makeId: string): CarModel[] {
  return modelsByMake.get(makeId) ?? [];
}
export function getModel(makeSlug: string, modelSlug: string): CarModel | undefined {
  return modelById.get(`${makeSlug}-${modelSlug}`);
}
export function getModelById(id: string): CarModel | undefined {
  return modelById.get(id);
}
export function modelYears(model: CarModel): string {
  return `${model.yearFrom}${EN_DASH}${model.yearTo ?? "дотепер"}`;
}
export function getMakeProductCount(makeId: string): number {
  return makeProductCount.get(makeId) ?? 0;
}
export function getModelProductCount(modelId: string): number {
  return modelProductCount.get(modelId) ?? 0;
}

// ── products ────────────────────────────────────────────────
export function getProducts(): Product[] {
  return products;
}
export function getProduct(slug: string): Product | undefined {
  return productBySlug.get(slug);
}
export function getProductById(id: string): Product | undefined {
  return productById.get(id);
}

// ── filtering internals ─────────────────────────────────────
const inStock = (p: Product) => p.stock === "in_stock" || p.stock === "low_stock";

function inCategory(p: Product, categoryId: string): boolean {
  return descendantLeaves.get(categoryId)?.has(p.categoryId) ?? false;
}

function vehicleMatch(p: Product, query: ProductQuery): boolean {
  if (!query.makeId && !query.modelId) return true;
  if (p.universal) return query.includeUniversal === true;
  if (query.modelId) return p.fitment.some((f) => f.modelId === query.modelId);
  return p.fitment.some((f) => f.makeId === query.makeId);
}

function textMatch(p: Product, q: string): boolean {
  const tokens = tokenize(q);
  if (tokens.length === 0) return true;
  return searchScore(searchMeta.get(p.id)!, tokens, normalizeCode(q)) > 0;
}

type SkipKey = "category" | "brand" | "vehicle" | "price" | "stock" | "badge" | "q";
const NO_SKIP: ReadonlySet<SkipKey> = new Set<SkipKey>();

function passes(p: Product, query: ProductQuery, skip: ReadonlySet<SkipKey>): boolean {
  if (!skip.has("category") && query.categoryId && !inCategory(p, query.categoryId)) return false;
  if (!skip.has("brand") && query.brandIds && query.brandIds.length > 0 && !query.brandIds.includes(p.brandId)) return false;
  if (!skip.has("vehicle") && !vehicleMatch(p, query)) return false;
  if (!skip.has("price")) {
    if (query.priceMin != null && p.price < query.priceMin) return false;
    if (query.priceMax != null && p.price > query.priceMax) return false;
  }
  if (!skip.has("stock") && query.inStockOnly && !inStock(p)) return false;
  if (!skip.has("badge") && query.badge && !p.badges.includes(query.badge)) return false;
  if (!skip.has("q") && query.q && !textMatch(p, query.q)) return false;
  return true;
}

function filterBy(query: ProductQuery, skip: ReadonlySet<SkipKey>): Product[] {
  return products.filter((p) => passes(p, query, skip));
}

function sortProducts(list: Product[], sort: ProductQuery["sort"]): Product[] {
  const mode = sort ?? "popular";
  return [...list].sort((a, b) => {
    const oa = a.stock === "out_of_stock" ? 1 : 0;
    const ob = b.stock === "out_of_stock" ? 1 : 0;
    if (oa !== ob) return oa - ob; // out_of_stock always sinks to the end
    let d = 0;
    switch (mode) {
      case "price_asc":
        d = a.price - b.price;
        break;
      case "price_desc":
        d = b.price - a.price;
        break;
      case "new":
        d = b.createdAt.localeCompare(a.createdAt);
        break;
      case "rating":
        d = b.rating - a.rating || b.reviewsCount - a.reviewsCount;
        break;
      default:
        d = b.popularity - a.popularity;
    }
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });
}

function countBy<T>(items: Product[], key: (p: Product) => string | undefined, resolve: (id: string) => T | undefined): FacetCount<T>[] {
  const counts = new Map<string, number>();
  for (const p of items) {
    const id = key(p);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const out: FacetCount<T>[] = [];
  for (const [id, count] of counts) {
    const item = resolve(id);
    if (item) out.push({ item, count });
  }
  return out;
}

// ── queryProducts ───────────────────────────────────────────
export function queryProducts(query: ProductQuery): ProductQueryResult {
  const items = filterBy(query, NO_SKIP);

  // facets
  const brandFacetSet = filterBy(query, new Set<SkipKey>(["brand"]));
  const brandFacets = countBy(brandFacetSet, (p) => p.brandId, (id) => brandById.get(id)).sort(
    (a, b) => b.count - a.count || a.item.name.localeCompare(b.item.name, "uk"),
  );

  const categoryFacets = countBy(items, (p) => p.categoryId, (id) => categoryById.get(id)).sort(
    (a, b) => b.count - a.count || (categoryIndex.get(a.item.id) ?? 0) - (categoryIndex.get(b.item.id) ?? 0),
  );

  const priceFacetSet = filterBy(query, new Set<SkipKey>(["price"]));
  let priceRange: [number, number] = [0, 0];
  if (priceFacetSet.length > 0) {
    let min = Infinity;
    let max = -Infinity;
    for (const p of priceFacetSet) {
      if (p.price < min) min = p.price;
      if (p.price > max) max = p.price;
    }
    priceRange = [min, max];
  }

  const stockFacetSet = filterBy(query, new Set<SkipKey>(["stock"]));
  const inStockCount = stockFacetSet.reduce((n, p) => n + (inStock(p) ? 1 : 0), 0);

  // sort + paginate
  const sorted = sortProducts(items, query.sort);
  const total = sorted.length;
  const perPage = query.perPage && query.perPage > 0 ? query.perPage : 24;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(query.page ?? 1, 1), pageCount);
  const pageItems = sorted.slice((page - 1) * perPage, page * perPage);

  return {
    items: pageItems,
    total,
    page,
    perPage,
    pageCount,
    facets: {
      brands: brandFacets,
      categories: categoryFacets,
      priceRange,
      inStockCount,
    },
  };
}

// ── curated lists ───────────────────────────────────────────
export function getNewProducts(limit: number): Product[] {
  return [...products]
    .filter((p) => p.stock !== "out_of_stock")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.popularity - a.popularity || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function getSaleProducts(limit: number): Product[] {
  const discount = (p: Product) => (p.oldPrice && p.oldPrice > p.price ? (p.oldPrice - p.price) / p.oldPrice : 0);
  return products
    .filter((p) => p.stock !== "out_of_stock" && discount(p) > 0)
    .sort((a, b) => discount(b) - discount(a) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function getPopularProducts(limit: number): Product[] {
  return [...products]
    .filter((p) => p.stock !== "out_of_stock")
    .sort((a, b) => b.popularity - a.popularity || a.id.localeCompare(b.id))
    .slice(0, limit);
}

// ── related ─────────────────────────────────────────────────
function topLevelOf(categoryId: string): string {
  return categoryById.get(categoryId)?.parentId ?? categoryId;
}

export function getRelatedProducts(product: Product, limit: number): Product[] {
  const fitModels = new Set(product.fitment.map((f) => f.modelId));
  const sharesVehicle = (p: Product) => p.fitment.some((f) => fitModels.has(f.modelId));

  const sameLeaf = products
    .filter((p) => p.id !== product.id && p.categoryId === product.categoryId)
    .sort(
      (a, b) =>
        Number(sharesVehicle(b)) - Number(sharesVehicle(a)) ||
        b.popularity - a.popularity ||
        a.id.localeCompare(b.id),
    );

  if (sameLeaf.length >= limit) return sameLeaf.slice(0, limit);

  const top = topLevelOf(product.categoryId);
  const seen = new Set(sameLeaf.map((p) => p.id));
  const sameGroup = products
    .filter(
      (p) =>
        p.id !== product.id &&
        !seen.has(p.id) &&
        p.categoryId !== product.categoryId &&
        topLevelOf(p.categoryId) === top,
    )
    .sort((a, b) => b.popularity - a.popularity || a.id.localeCompare(b.id));

  return [...sameLeaf, ...sameGroup].slice(0, limit);
}

// ── reviews ─────────────────────────────────────────────────
export function getReviews(productId: string): Review[] {
  return reviewsByProduct.get(productId) ?? [];
}

// ── vehicle → categories ────────────────────────────────────
export function getCategoriesForVehicle(makeId: string, modelId?: string): FacetCount<Category>[] {
  const matches = (p: Product) =>
    !p.universal &&
    (modelId ? p.fitment.some((f) => f.modelId === modelId) : p.fitment.some((f) => f.makeId === makeId));

  const out: FacetCount<Category>[] = [];
  for (const leaf of leafCategories) {
    let count = 0;
    for (const p of products) if (p.categoryId === leaf.id && matches(p)) count++;
    if (count > 0) out.push({ item: leaf, count });
  }
  return out;
}

// ── search ──────────────────────────────────────────────────
export function searchCatalog(
  q: string,
  limit = 8,
): { products: Product[]; categories: Category[]; brands: Brand[]; total: number } {
  const query = q.trim();
  if (query.length < 2) return { products: [], categories: [], brands: [], total: 0 };

  const tokens = tokenize(query);
  const code = normalizeCode(query);

  const scored: { p: Product; score: number }[] = [];
  for (const p of products) {
    const score = searchScore(searchMeta.get(p.id)!, tokens, code);
    if (score > 0) scored.push({ p, score });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      Number(a.p.stock === "out_of_stock") - Number(b.p.stock === "out_of_stock") ||
      b.p.popularity - a.p.popularity ||
      a.p.id.localeCompare(b.p.id),
  );

  const matchesAllTokens = (name: string) => {
    const folded = fold(name);
    return tokens.every((t) => folded.includes(t));
  };
  const matchedCategories = categories
    .filter((c) => matchesAllTokens(c.name))
    .sort((a, b) => (categoryIndex.get(a.id) ?? 0) - (categoryIndex.get(b.id) ?? 0))
    .slice(0, limit);
  const matchedBrands = brandsSorted.filter((b) => matchesAllTokens(b.name)).slice(0, limit);

  return {
    products: scored.slice(0, limit).map((s) => s.p),
    categories: matchedCategories,
    brands: matchedBrands,
    total: scored.length,
  };
}
