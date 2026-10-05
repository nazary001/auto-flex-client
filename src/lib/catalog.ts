import { getDb } from "@/lib/server/db/client";
import * as q from "@/lib/server/catalog/queries";
import { getTaxonomy, invalidateTaxonomy } from "@/lib/server/catalog/taxonomy-cache";
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
 * Read-only catalog API for the storefront. Products live in MongoDB (synced from the supplier
 * or created in the admin); categories, brands, makes and models come from a cached taxonomy.
 * Every function is async; the data shapes are unchanged from the static demo catalog.
 */

const EN_DASH = "–";

export { invalidateTaxonomy };

// ── categories ──────────────────────────────────────────────
export async function getCategories(): Promise<Category[]> {
  return (await getTaxonomy()).categories;
}
export async function getTopCategories(): Promise<Category[]> {
  return (await getTaxonomy()).topCategories;
}
export async function getCategory(slug: string): Promise<Category | undefined> {
  return (await getTaxonomy()).categoryById.get(slug);
}
export async function getSubcategories(parentId: string): Promise<Category[]> {
  return (await getTaxonomy()).childrenByParent.get(parentId) ?? [];
}
export async function getCategoryPath(category: Category): Promise<Category[]> {
  const tax = await getTaxonomy();
  const path: Category[] = [category];
  let current = category;
  while (current.parentId) {
    const parent = tax.categoryById.get(current.parentId);
    if (!parent) break;
    path.unshift(parent);
    current = parent;
  }
  return path;
}
export async function getCategoryProductCount(categoryId: string): Promise<number> {
  return (await getTaxonomy()).categoryProductCount.get(categoryId) ?? 0;
}

// ── brands ──────────────────────────────────────────────────
export async function getBrands(): Promise<Brand[]> {
  return (await getTaxonomy()).brands;
}
export async function getBrand(slug: string): Promise<Brand | undefined> {
  return (await getTaxonomy()).brandById.get(slug);
}
export async function getBrandById(id: string): Promise<Brand | undefined> {
  return (await getTaxonomy()).brandById.get(id);
}
export async function getBrandProductCount(brandId: string): Promise<number> {
  return (await getTaxonomy()).brandProductCount.get(brandId) ?? 0;
}

// ── makes & models ──────────────────────────────────────────
export async function getMakes(): Promise<Make[]> {
  return (await getTaxonomy()).makes;
}
export async function getMake(slug: string): Promise<Make | undefined> {
  return (await getTaxonomy()).makeById.get(slug);
}
export async function getMakeById(id: string): Promise<Make | undefined> {
  return (await getTaxonomy()).makeById.get(id);
}
export async function getModels(makeId: string): Promise<CarModel[]> {
  return (await getTaxonomy()).modelsByMake.get(makeId) ?? [];
}
export async function getModel(makeSlug: string, modelSlug: string): Promise<CarModel | undefined> {
  return (await getTaxonomy()).modelById.get(`${makeSlug}-${modelSlug}`);
}
export async function getModelById(id: string): Promise<CarModel | undefined> {
  return (await getTaxonomy()).modelById.get(id);
}
export function modelYears(model: CarModel): string {
  if (!model.yearFrom) return "";
  return `${model.yearFrom}${EN_DASH}${model.yearTo ?? "дотепер"}`;
}
export async function getMakeProductCount(makeId: string): Promise<number> {
  return (await getTaxonomy()).makeProductCount.get(makeId) ?? 0;
}
export async function getModelProductCount(modelId: string): Promise<number> {
  return (await getTaxonomy()).modelProductCount.get(modelId) ?? 0;
}

// ── products ────────────────────────────────────────────────
export async function getProduct(slug: string): Promise<Product | undefined> {
  return (await q.getProductBySlug(await getDb(), slug)) ?? undefined;
}
export async function getProductById(id: string): Promise<Product | undefined> {
  return (await q.getProductById(await getDb(), id)) ?? undefined;
}
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  return q.getProductsByIds(await getDb(), ids);
}
export async function countProducts(): Promise<number> {
  return q.countVisibleProducts(await getDb());
}
/** For the sitemap: visible product slugs in stable order */
export async function listProductSlugs(offset: number, limit: number): Promise<{ slug: string; updatedAt: string }[]> {
  return q.listProductSlugs(await getDb(), offset, limit);
}
export async function queryProducts(query: ProductQuery): Promise<ProductQueryResult> {
  return q.queryProducts(await getDb(), query);
}
export async function getNewProducts(limit: number): Promise<Product[]> {
  return q.getNewProducts(await getDb(), limit);
}
export async function getSaleProducts(limit: number): Promise<Product[]> {
  return q.getSaleProducts(await getDb(), limit);
}
export async function getPopularProducts(limit: number): Promise<Product[]> {
  return q.getPopularProducts(await getDb(), limit);
}
export async function getRelatedProducts(product: Product, limit: number): Promise<Product[]> {
  return q.getRelatedProducts(await getDb(), product, limit);
}

// ── reviews ─────────────────────────────────────────────────
export async function getReviews(productId: string): Promise<Review[]> {
  return q.getApprovedReviews(await getDb(), productId);
}

// ── vehicle → categories ────────────────────────────────────
export async function getCategoriesForVehicle(makeId: string, modelId?: string): Promise<FacetCount<Category>[]> {
  return q.getCategoriesForVehicle(await getDb(), makeId, modelId);
}

// ── search ──────────────────────────────────────────────────
export async function searchCatalog(
  query: string,
  limit = 8,
): Promise<{ products: Product[]; categories: Category[]; brands: Brand[]; total: number }> {
  return q.searchCatalog(await getDb(), query, limit);
}
