import type { Db, Filter, Sort } from "mongodb";
import type { Product, ProductBadge, StockStatus } from "@/lib/types";
import type { ModeratedReview, Page, ReviewStatus } from "@/lib/admin/types";
import { fold, normalizeCode } from "@/lib/slug";
import { cols, type CategoryDoc, type ProductDoc, type ProductSource } from "@/lib/server/db/collections";
import { docToProduct } from "@/lib/server/catalog/product-doc";
import { getProductDoc, getProductDocBySlug, getProductDocs } from "@/lib/server/catalog/products";
import { getTaxonomy, type Taxonomy } from "@/lib/server/catalog/taxonomy-cache";
import { costUah } from "@/lib/server/suppliers/ddtuning/mapping";
import { countReviewsByStatus, listReviews } from "@/lib/server/db/repos/reviews";
import { getSettings } from "@/lib/server/db/repos/settings";

/*
 * Read models for the catalog admin. The catalog lives in MongoDB (products synced from the DD
 * Tuning supplier or created by hand); these helpers page the products collection in the database,
 * add the admin-only facts (source, edited/hidden/retired, supplier cost and margin, variants) and
 * shape the list, detail and form pages. Categories, brands, makes and models come from the cached
 * taxonomy; the category / brand managers read their collections directly so hidden rows stay
 * visible in the back office.
 */

const ADMIN_PER_PAGE = 25;
/** CSV export is streamed from a cursor; cap it so a huge catalog cannot exhaust memory. */
const EXPORT_LIMIT = 20_000;
const NEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── product list ────────────────────────────────────────────

export interface ProductFilter {
  q?: string;
  /** Leaf or group category id */
  category?: string;
  brand?: string;
  stock?: string;
  badge?: string;
  /** "" (усі) | hidden | edited | new | manual | no_cost | retired */
  state?: string;
  /** name | price_asc | price_desc | newest | popular */
  sort?: string;
}

export interface AdminProductRow {
  id: string;
  slug: string;
  sku: string;
  name: string;
  brandName: string;
  categoryName: string;
  illustration: string;
  image?: string;
  price: number;
  oldPrice?: number;
  stock: StockStatus;
  deliveryDays: [number, number];
  badges: ProductBadge[];
  source: ProductSource;
  hidden: boolean;
  retired: boolean;
  /** Admin overrides are stored on this product */
  edited: boolean;
  /** Number of supplier variants (0 when the product has no variant option) */
  variants: number;
  /** Supplier cost (UAH), when known */
  cost?: number;
  marginPercent?: number;
  createdAt: string;
  popularity: number;
}

/** Heavy fields the list never needs — kept off the wire for an 80k catalog */
const LIST_PROJECTION = { search: 0, "supplier.items": 0, description: 0, specs: 0 };

function hasLocal(doc: Pick<ProductDoc, "local">): boolean {
  return Boolean(doc.local && Object.keys(doc.local).length > 0);
}

function toRow(doc: ProductDoc, tax: Taxonomy): AdminProductRow {
  const cost = doc.supplier?.costPrice;
  const marginPercent = cost != null && cost > 0 && doc.price > 0 ? Math.round(((doc.price - cost) / doc.price) * 100) : undefined;
  return {
    id: doc._id,
    slug: doc.slug,
    sku: doc.sku,
    name: doc.name,
    brandName: doc.brandName ?? tax.brandById.get(doc.brandId)?.name ?? doc.brandId,
    categoryName: doc.categoryName ?? tax.categoryById.get(doc.categoryId)?.name ?? doc.categoryId,
    illustration: doc.illustration ?? tax.categoryById.get(doc.categoryId)?.illustration ?? "_fallback",
    image: doc.images[0],
    price: doc.price,
    oldPrice: doc.oldPrice,
    stock: doc.stock,
    deliveryDays: doc.deliveryDays,
    badges: doc.badges,
    source: doc.source,
    hidden: doc.hidden,
    retired: Boolean(doc.retired),
    edited: hasLocal(doc),
    variants: doc.option?.values.length ?? 0,
    cost,
    marginPercent,
    createdAt: doc.createdAt,
    popularity: doc.popularity,
  };
}

/** Builds the MongoDB match from the admin filter (admin sees hidden and retired products too). */
function buildProductMatch(filter: ProductFilter, tax: Taxonomy): Filter<ProductDoc> {
  const match: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];

  const q = filter.q?.trim();
  if (q && q.length >= 2) {
    const folded = fold(q);
    const code = normalizeCode(q);
    const or: Record<string, unknown>[] = [
      { search: { $regex: escapeRegex(folded), $options: "i" } },
      { skus: { $in: [q, q.toUpperCase()] } },
    ];
    if (code.length >= 2 && code !== folded) or.push({ search: { $regex: escapeRegex(code), $options: "i" } });
    and.push({ $or: or });
  }

  if (filter.category) {
    const category = tax.categoryById.get(filter.category);
    if (category && category.parentId === null) match.groupId = filter.category;
    else match.categoryId = filter.category;
  }
  if (filter.brand) match.brandId = filter.brand;
  if (filter.stock) match.stock = filter.stock;
  if (filter.badge) match.badges = filter.badge;

  switch (filter.state) {
    case "hidden":
      match.hidden = true;
      break;
    case "edited":
      match.local = { $exists: true, $ne: null };
      break;
    case "new":
      match.source = "ddtuning";
      match.createdAt = { $gte: new Date(Date.now() - NEW_WINDOW_MS).toISOString() };
      break;
    case "manual":
      match.source = "manual";
      break;
    case "no_cost":
      match.source = "ddtuning";
      match["supplier.costPrice"] = { $exists: false };
      break;
    case "retired":
      match.retired = true;
      break;
    default:
      break;
  }

  if (and.length) match.$and = and;
  return match as Filter<ProductDoc>;
}

function sortFor(sort: string | undefined): Sort {
  switch (sort) {
    case "name":
      return { name: 1, _id: 1 };
    case "price_asc":
      return { price: 1, _id: 1 };
    case "price_desc":
      return { price: -1, _id: 1 };
    case "newest":
      return { createdAt: -1, _id: 1 };
    default:
      return { popularity: -1, _id: 1 };
  }
}

export async function listAdminProducts(
  db: Db,
  filter: ProductFilter,
  page: number,
  perPage = ADMIN_PER_PAGE,
): Promise<Page<AdminProductRow>> {
  const tax = await getTaxonomy();
  const match = buildProductMatch(filter, tax);
  const products = cols(db).products;
  const total = await products.countDocuments(match);
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), pageCount);
  const docs = await products
    .find(match, { projection: LIST_PROJECTION, sort: sortFor(filter.sort), skip: (current - 1) * perPage, limit: perPage })
    .toArray();
  return { items: docs.map((d) => toRow(d, tax)), total, page: current, perPage, pageCount };
}

/** Rows for the CSV export — same filter, no paging, capped at EXPORT_LIMIT. */
export async function listAdminProductsForExport(db: Db, filter: ProductFilter): Promise<AdminProductRow[]> {
  const tax = await getTaxonomy();
  const match = buildProductMatch(filter, tax);
  const rows: AdminProductRow[] = [];
  const cursor = cols(db)
    .products.find(match, { projection: LIST_PROJECTION, sort: sortFor(filter.sort), limit: EXPORT_LIMIT });
  for await (const doc of cursor) rows.push(toRow(doc, tax));
  return rows;
}

// ── product filter options (category + brand selects) ───────

export interface CategoryGroupOption {
  id: string;
  name: string;
  leaves: { id: string; name: string }[];
}

export async function getProductFilterOptions(): Promise<{
  groups: CategoryGroupOption[];
  brands: { id: string; name: string }[];
}> {
  const tax = await getTaxonomy();
  const groups = tax.topCategories.map((g) => ({
    id: g.id,
    name: g.name,
    leaves: (tax.childrenByParent.get(g.id) ?? []).map((l) => ({ id: l.id, name: l.name })),
  }));
  return { groups, brands: tax.brands.map((b) => ({ id: b.id, name: b.name })) };
}

// ── product detail ──────────────────────────────────────────

export interface SupplierItemView {
  id: number;
  sku: string;
  title: string;
  short?: string;
  qty: number;
  warehouse?: string;
  price: number;
  salePrice?: number;
  costOriginal?: number;
  costCurrency?: string;
  costUah?: number;
  images: number;
}

export interface AdminProductDetail {
  product: Product;
  source: ProductSource;
  hidden: boolean;
  retired: boolean;
  edited: boolean;
  isVariantGroup: boolean;
  supplier?: {
    code: string;
    groupId?: number;
    syncedAt: string;
    costPrice?: number;
    costCurrency?: string;
    costOriginal?: number;
    items: SupplierItemView[];
  };
}

export async function getAdminProductDetail(db: Db, id: string): Promise<AdminProductDetail | null> {
  const doc = await getProductDoc(db, id);
  if (!doc) return null;
  const tax = await getTaxonomy();
  const product = docToProduct(doc);
  if (!product.brandName) product.brandName = tax.brandById.get(product.brandId)?.name;
  if (!product.categoryName) {
    const category = tax.categoryById.get(product.categoryId);
    if (category) {
      product.categoryName = category.name;
      if (!product.illustration) product.illustration = category.illustration;
    }
  }

  let supplier: AdminProductDetail["supplier"];
  if (doc.supplier) {
    const settings = await getSettings(db);
    const rates = { EUR: settings.supplier.rates.EUR, USD: settings.supplier.rates.USD };
    supplier = {
      code: doc.supplier.code,
      groupId: doc.supplier.groupId,
      syncedAt: doc.supplier.syncedAt,
      costPrice: doc.supplier.costPrice,
      costCurrency: doc.supplier.costCurrency,
      costOriginal: doc.supplier.costOriginal,
      items: doc.supplier.items.map((item) => ({
        id: item.id,
        sku: item.sku,
        title: item.title,
        short: item.short,
        qty: item.qty,
        warehouse: item.warehouse,
        price: item.price,
        salePrice: item.salePrice,
        costOriginal: item.cost?.amount,
        costCurrency: item.cost?.currency,
        costUah: costUah(item, rates),
        images: item.images.length,
      })),
    };
  }

  return {
    product,
    source: doc.source,
    hidden: doc.hidden,
    retired: Boolean(doc.retired),
    edited: hasLocal(doc),
    isVariantGroup: Boolean(doc.option && doc.option.id === "variant"),
    supplier,
  };
}

// ── product form data ───────────────────────────────────────

export interface ProductFormData {
  categoryGroups: CategoryGroupOption[];
  brands: { id: string; name: string }[];
  makes: { id: string; name: string }[];
  /** Models of the makes the product already lists; the rest load on demand in the fitment editor */
  initialModels: { id: string; makeId: string; name: string }[];
  badges: { value: ProductBadge; label: string }[];
  illustrations: string[];
  defaultMarkupPercent: number;
}

function leafIllustrationKeys(tax: Taxonomy): string[] {
  return [...new Set(tax.leafCategories.map((c) => c.illustration))].sort();
}

export async function getProductFormData(db: Db, product?: Product): Promise<ProductFormData> {
  const [tax, settings] = await Promise.all([getTaxonomy(), getSettings(db)]);
  const categoryGroups = tax.topCategories.map((g) => ({
    id: g.id,
    name: g.name,
    leaves: (tax.childrenByParent.get(g.id) ?? []).map((l) => ({ id: l.id, name: l.name })),
  }));
  const fitMakeIds = new Set((product?.fitment ?? []).map((f) => f.makeId));
  const initialModels = tax.models
    .filter((m) => fitMakeIds.has(m.makeId))
    .map((m) => ({ id: m.id, makeId: m.makeId, name: m.name }));
  return {
    categoryGroups,
    brands: tax.brands.map((b) => ({ id: b.id, name: b.name })),
    makes: tax.makes.map((m) => ({ id: m.id, name: m.name })),
    initialModels,
    badges: [
      { value: "new", label: "Новинка" },
      { value: "sale", label: "Акція" },
      { value: "hit", label: "Хіт" },
    ],
    illustrations: leafIllustrationKeys(tax),
    defaultMarkupPercent: settings.orders.defaultMarkupPercent,
  };
}

/** Models of one make, for the fitment editor's on-demand loading. */
export async function getModelsForMake(makeId: string): Promise<{ id: string; makeId: string; name: string }[]> {
  const tax = await getTaxonomy();
  return (tax.modelsByMake.get(makeId) ?? []).map((m) => ({ id: m.id, makeId: m.makeId, name: m.name }));
}

/** Leaf illustration keys available for the category editor. */
export async function getIllustrationKeys(): Promise<string[]> {
  return leafIllustrationKeys(await getTaxonomy());
}

/** True when another product already owns the slug. */
export async function slugTaken(db: Db, slug: string, exceptId: string): Promise<boolean> {
  const doc = await getProductDocBySlug(db, slug);
  return Boolean(doc && doc._id !== exceptId);
}

// ── categories ──────────────────────────────────────────────

export interface AdminCategoryLeaf {
  id: string;
  slug: string;
  name: string;
  illustration: string;
  productCount: number;
  hidden: boolean;
  edited: boolean;
}

export interface AdminCategoryGroup {
  id: string;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  productCount: number;
  hidden: boolean;
  edited: boolean;
  leaves: AdminCategoryLeaf[];
}

function categoryEdited(doc: CategoryDoc): boolean {
  return Boolean(doc.local && Object.keys(doc.local).length > 0);
}

export async function listAdminCategories(db: Db): Promise<AdminCategoryGroup[]> {
  const docs = await cols(db).categories.find().sort({ sort: 1, name: 1 }).toArray();
  const groups = docs.filter((d) => d.parentId === null);
  return groups.map((g) => {
    const leaves: AdminCategoryLeaf[] = docs
      .filter((d) => d.parentId === g._id)
      .map((l) => ({
        id: l._id,
        slug: l.slug,
        name: l.local?.name ?? l.name,
        illustration: l.local?.illustration ?? l.illustration,
        productCount: l.productCount,
        hidden: l.hidden,
        edited: categoryEdited(l),
      }));
    return {
      id: g._id,
      slug: g.slug,
      name: g.local?.name ?? g.name,
      description: g.local?.description ?? g.description,
      icon: g.local?.icon ?? g.icon,
      productCount: g.productCount,
      hidden: g.hidden,
      edited: categoryEdited(g),
      leaves,
    };
  });
}

// ── brands ──────────────────────────────────────────────────

export interface AdminBrandRow {
  id: string;
  slug: string;
  name: string;
  country: string;
  description: string;
  popular: boolean;
  productCount: number;
  hidden: boolean;
  edited: boolean;
}

export async function listAdminBrands(db: Db): Promise<AdminBrandRow[]> {
  const docs = await cols(db).brands.find().toArray();
  return docs
    .map((b) => ({
      id: b._id,
      slug: b.slug,
      name: b.local?.name ?? b.name,
      country: b.local?.country ?? b.country,
      description: b.local?.description ?? b.description,
      popular: Boolean(b.local?.popular ?? b.popular),
      productCount: b.productCount,
      hidden: b.hidden,
      edited: Boolean(b.local && Object.keys(b.local).length > 0),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "uk"));
}

// ── reviews ─────────────────────────────────────────────────

export interface AdminReviewRow extends ModeratedReview {
  productName: string;
  productSlug?: string;
  productSku?: string;
}

export async function reviewStatusCounts(db: Db): Promise<Record<ReviewStatus, number>> {
  return countReviewsByStatus(db);
}

export async function listAdminReviews(
  db: Db,
  filter: { status?: ReviewStatus; q?: string },
  page: number,
  perPage = 25,
): Promise<Page<AdminReviewRow>> {
  const result = await listReviews(
    db,
    { status: filter.status ? [filter.status] : undefined, q: filter.q },
    { page: Math.max(1, page), perPage },
  );
  const ids = [...new Set(result.items.map((r) => r.productId))];
  const docs = await getProductDocs(db, ids);
  const byId = new Map(docs.map((d) => [d._id, d]));
  const items: AdminReviewRow[] = result.items.map((review) => {
    const doc = byId.get(review.productId);
    return { ...review, productName: doc?.name ?? "Невідомий товар", productSlug: doc?.slug, productSku: doc?.sku };
  });
  return { ...result, items };
}

// ── supplier catalog stats (the /admin/supplier overview) ───

export interface SupplierCatalogStats {
  total: number;
  ddtuning: number;
  manual: number;
  demo: number;
  hidden: number;
  retired: number;
  withCost: number;
  withoutCost: number;
}

export async function getSupplierCatalogStats(db: Db): Promise<SupplierCatalogStats> {
  const [row] = await cols(db)
    .products.aggregate<{
      total: number;
      ddtuning: number;
      manual: number;
      demo: number;
      hidden: number;
      retired: number;
      withCost: number;
    }>([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          ddtuning: { $sum: { $cond: [{ $eq: ["$source", "ddtuning"] }, 1, 0] } },
          manual: { $sum: { $cond: [{ $eq: ["$source", "manual"] }, 1, 0] } },
          demo: { $sum: { $cond: [{ $eq: ["$source", "demo"] }, 1, 0] } },
          hidden: { $sum: { $cond: ["$hidden", 1, 0] } },
          retired: { $sum: { $cond: [{ $ifNull: ["$retired", false] }, 1, 0] } },
          withCost: { $sum: { $cond: [{ $gt: [{ $ifNull: ["$supplier.costPrice", 0] }, 0] }, 1, 0] } },
        },
      },
    ])
    .toArray();
  const ddtuning = row?.ddtuning ?? 0;
  const withCost = row?.withCost ?? 0;
  return {
    total: row?.total ?? 0,
    ddtuning,
    manual: row?.manual ?? 0,
    demo: row?.demo ?? 0,
    hidden: row?.hidden ?? 0,
    retired: row?.retired ?? 0,
    withCost,
    withoutCost: Math.max(0, ddtuning - withCost),
  };
}
