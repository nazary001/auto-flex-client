import type { Db } from "mongodb";
import type { Brand, CarModel, Category, Make } from "@/lib/types";
import { getDb } from "@/lib/server/db/client";
import { cols, type BrandDoc, type CategoryDoc, type MakeDoc, type ModelDoc } from "@/lib/server/db/collections";

/*
 * Categories, brands, makes and models are a few thousand small documents that every page needs
 * (header menu, breadcrumbs, filters). They are loaded into memory once per process and refreshed
 * at most every 60 s; writes call invalidateTaxonomy() so the next read reloads immediately.
 */

const TTL_MS = 60_000;

export interface Taxonomy {
  categories: Category[];
  categoryById: Map<string, Category>;
  categoryIndex: Map<string, number>;
  childrenByParent: Map<string, Category[]>;
  topCategories: Category[];
  leafCategories: Category[];
  /** Leaf ids covered by a category (itself when it is a leaf) */
  descendantLeaves: Map<string, Set<string>>;
  categoryProductCount: Map<string, number>;
  brands: Brand[];
  brandById: Map<string, Brand>;
  brandProductCount: Map<string, number>;
  makes: Make[];
  makeById: Map<string, Make>;
  makeProductCount: Map<string, number>;
  models: CarModel[];
  modelById: Map<string, CarModel>;
  modelsByMake: Map<string, CarModel[]>;
  modelProductCount: Map<string, number>;
  loadedAt: number;
}

interface TaxonomyGlobal {
  __afTaxonomy?: Taxonomy;
  __afTaxonomyInflight?: Promise<Taxonomy> | null;
}
const g = globalThis as unknown as TaxonomyGlobal;

function effectiveCategory(doc: CategoryDoc): Category {
  const { _id, local, ...rest } = doc;
  const base: Category = {
    id: _id,
    slug: rest.slug,
    name: local?.name ?? rest.name,
    parentId: rest.parentId,
    illustration: local?.illustration ?? rest.illustration,
  };
  const icon = local?.icon ?? rest.icon;
  const description = local?.description ?? rest.description;
  if (icon) base.icon = icon;
  if (description) base.description = description;
  return base;
}

function effectiveBrand(doc: BrandDoc): Brand {
  const { _id, local, ...rest } = doc;
  const brand: Brand = {
    id: _id,
    slug: rest.slug,
    name: local?.name ?? rest.name,
    country: local?.country ?? rest.country,
    description: local?.description ?? rest.description,
  };
  if (local?.popular ?? rest.popular) brand.popular = true;
  return brand;
}

function toMake(doc: MakeDoc): Make {
  const make: Make = { id: doc._id, slug: doc.slug, name: doc.name, country: doc.country };
  if (doc.popular) make.popular = true;
  return make;
}

function toModel(doc: ModelDoc): CarModel {
  return { id: doc._id, slug: doc.slug, makeId: doc.makeId, name: doc.name, yearFrom: doc.yearFrom, yearTo: doc.yearTo, body: doc.body };
}

export function buildTaxonomy(
  categoryDocs: CategoryDoc[],
  brandDocs: BrandDoc[],
  makeDocs: MakeDoc[],
  modelDocs: ModelDoc[],
): Taxonomy {
  // storefront menus show only categories that have products (leaves without stock-keeping items stay in the admin)
  const anyCounted = categoryDocs.some((d) => d.productCount > 0);
  const visibleCategoryDocs = categoryDocs
    .filter((d) => !d.hidden && (!anyCounted || d.productCount > 0))
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "uk"));
  // top groups first (in sort order), then their leaves — the order the storefront menus expect
  const groups = visibleCategoryDocs.filter((d) => d.parentId === null);
  const ordered: CategoryDoc[] = [];
  for (const group of groups) {
    ordered.push(group);
    for (const leaf of visibleCategoryDocs) if (leaf.parentId === group._id) ordered.push(leaf);
  }
  // leaves whose group is hidden/missing are not shown
  const categories = ordered.map(effectiveCategory);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const categoryIndex = new Map(categories.map((c, i) => [c.id, i]));
  const childrenByParent = new Map<string, Category[]>();
  for (const c of categories) {
    if (!c.parentId) continue;
    const list = childrenByParent.get(c.parentId) ?? [];
    list.push(c);
    childrenByParent.set(c.parentId, list);
  }
  const topCategories = categories.filter((c) => c.parentId === null);
  const leafCategories = categories.filter((c) => c.parentId !== null);
  const descendantLeaves = new Map<string, Set<string>>();
  for (const c of categories) {
    descendantLeaves.set(
      c.id,
      c.parentId === null ? new Set((childrenByParent.get(c.id) ?? []).map((l) => l.id)) : new Set([c.id]),
    );
  }
  const categoryProductCount = new Map(ordered.map((d) => [d._id, d.productCount]));

  const brandDocsVisible = brandDocs.filter((d) => !d.hidden);
  const brands = brandDocsVisible.map(effectiveBrand).sort((a, b) => a.name.localeCompare(b.name, "uk"));
  const brandById = new Map(brands.map((b) => [b.id, b]));
  const brandProductCount = new Map(brandDocsVisible.map((d) => [d._id, d.productCount]));

  const makes = makeDocs.map(toMake).sort((a, b) => a.name.localeCompare(b.name, "uk"));
  const makeById = new Map(makes.map((m) => [m.id, m]));
  const makeProductCount = new Map(makeDocs.map((d) => [d._id, d.productCount]));

  const models = modelDocs.map(toModel);
  const modelById = new Map(models.map((m) => [m.id, m]));
  const modelsByMake = new Map<string, CarModel[]>();
  for (const m of models) {
    const list = modelsByMake.get(m.makeId) ?? [];
    list.push(m);
    modelsByMake.set(m.makeId, list);
  }
  for (const [, list] of modelsByMake) list.sort((a, b) => a.name.localeCompare(b.name, "uk") || a.yearFrom - b.yearFrom);
  const modelProductCount = new Map(modelDocs.map((d) => [d._id, d.productCount]));

  return {
    categories,
    categoryById,
    categoryIndex,
    childrenByParent,
    topCategories,
    leafCategories,
    descendantLeaves,
    categoryProductCount,
    brands,
    brandById,
    brandProductCount,
    makes,
    makeById,
    makeProductCount,
    models,
    modelById,
    modelsByMake,
    modelProductCount,
    loadedAt: Date.now(),
  };
}

export async function loadTaxonomy(db: Db): Promise<Taxonomy> {
  const c = cols(db);
  const [categories, brands, makes, models] = await Promise.all([
    c.categories.find().toArray(),
    c.brands.find().toArray(),
    c.makes.find().toArray(),
    c.models.find().toArray(),
  ]);
  return buildTaxonomy(categories, brands, makes, models);
}

/** Cached taxonomy (reloaded when older than 60 s or after invalidateTaxonomy) */
export async function getTaxonomy(): Promise<Taxonomy> {
  const cached = g.__afTaxonomy;
  if (cached && Date.now() - cached.loadedAt < TTL_MS) return cached;
  if (!g.__afTaxonomyInflight) {
    g.__afTaxonomyInflight = (async () => {
      try {
        const fresh = await loadTaxonomy(await getDb());
        g.__afTaxonomy = fresh;
        return fresh;
      } finally {
        g.__afTaxonomyInflight = null;
      }
    })();
  }
  try {
    return await g.__afTaxonomyInflight;
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}

export function invalidateTaxonomy(): void {
  g.__afTaxonomy = undefined;
}

/** Test hook */
export function setTaxonomyForTests(taxonomy: Taxonomy | undefined): void {
  g.__afTaxonomy = taxonomy;
}
