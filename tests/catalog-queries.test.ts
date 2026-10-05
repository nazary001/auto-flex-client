import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "mongodb";
import { products as staticProducts } from "@/data/products";
import * as q from "@/lib/server/catalog/queries";
import { setProductHidden, setProductLocal, recountTaxonomy } from "@/lib/server/catalog/products";
import { docToProduct } from "@/lib/server/catalog/product-doc";
import { getTaxonomy, invalidateTaxonomy } from "@/lib/server/catalog/taxonomy-cache";
import { importDemoCatalog } from "@/lib/server/suppliers/ddtuning/demo-import";
import { startTestDb, stopTestDb } from "@/lib/server/db/testing";

let db: Db;

beforeAll(async () => {
  db = await startTestDb();
  await importDemoCatalog(db);
});

afterAll(async () => {
  await stopTestDb();
});

describe("catalog queries (demo import)", () => {
  it("imports the demo catalog with counts and denormalised fields", async () => {
    const tax = await getTaxonomy();
    expect(tax.topCategories).toHaveLength(12);
    expect(tax.leafCategories).toHaveLength(58);
    expect(await q.countVisibleProducts(db)).toBe(staticProducts.length);
    const sample = await q.getProductBySlug(db, staticProducts[0].slug);
    expect(sample?.brandName).toBeTruthy();
    expect(sample?.categoryName).toBeTruthy();
    expect(sample?.groupId).toBe(tax.categoryById.get(sample!.categoryId)?.parentId);
    expect(tax.categoryProductCount.get("halmivna-systema")).toBeGreaterThan(0);
    expect(tax.makeProductCount.get("skoda")).toBeGreaterThan(0);
  });

  it("lists a category with facets, sorting and paging", async () => {
    const result = await q.queryProducts(db, { categoryId: "halmivna-systema", sort: "price_asc", perPage: 10, page: 1 });
    expect(result.total).toBeGreaterThan(10);
    expect(result.items).toHaveLength(10);
    expect(result.facets.brands.length).toBeGreaterThan(1);
    expect(result.facets.categories.every((f) => f.item.parentId === "halmivna-systema")).toBe(true);
    expect(result.facets.priceRange[0]).toBeLessThanOrEqual(result.items[0].price);
    const prices = result.items.filter((p) => p.stock !== "out_of_stock").map((p) => p.price);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    const brandOnly = await q.queryProducts(db, { categoryId: "halmivna-systema", brandIds: [result.facets.brands[0].item.id] });
    expect(brandOnly.total).toBe(result.facets.brands[0].count);
    expect(brandOnly.facets.brands.length).toBe(result.facets.brands.length);
  });

  it("filters by vehicle and finds products by sku and words", async () => {
    const withFit = staticProducts.find((p) => p.fitment.length > 0)!;
    const fit = withFit.fitment[0];
    const byModel = await q.queryProducts(db, { modelId: fit.modelId, makeId: fit.makeId });
    expect(byModel.items.some((p) => p.id === withFit.id)).toBe(true);
    expect(byModel.items.every((p) => p.fitment.some((f) => f.modelId === fit.modelId))).toBe(true);

    const bySku = await q.searchCatalog(db, withFit.sku.toLowerCase(), 5);
    expect(bySku.products[0]?.id).toBe(withFit.id);
    const byWords = await q.searchCatalog(db, "гальмівні колодки", 5);
    expect(byWords.total).toBeGreaterThan(0);
    expect(byWords.categories.some((c) => c.slug === "halmivni-kolodky")).toBe(true);
    const inListing = await q.queryProducts(db, { q: "колодки", categoryId: "halmivna-systema" });
    expect(inListing.total).toBeGreaterThan(0);
    const vehicleCategories = await q.getCategoriesForVehicle(db, fit.makeId, fit.modelId);
    expect(vehicleCategories.some((c) => c.item.id === withFit.categoryId)).toBe(true);
  });

  it("serves curated lists and related products", async () => {
    expect((await q.getNewProducts(db, 8)).length).toBe(8);
    expect((await q.getSaleProducts(db, 8)).every((p) => p.oldPrice! > p.price)).toBe(true);
    const popular = await q.getPopularProducts(db, 5);
    expect(popular.every((p) => p.stock !== "out_of_stock")).toBe(true);
    const related = await q.getRelatedProducts(db, popular[0], 4);
    expect(related.length).toBe(4);
    expect(related.every((p) => p.id !== popular[0].id)).toBe(true);
  });

  it("hides products and applies admin overrides", async () => {
    const target = staticProducts[3];
    await setProductHidden(db, target.id, true);
    expect(await q.getProductById(db, target.id)).toBeNull();
    await setProductHidden(db, target.id, false);
    const edited = await setProductLocal(db, target.id, { name: "Перейменовано", markupPercent: 50 }, (doc) => docToProduct({ ...doc, name: target.name, price: target.price }));
    expect(edited?.name).toBe("Перейменовано");
    expect(edited?.price).toBeGreaterThan(target.price);
    const reset = await setProductLocal(db, target.id, null, (doc) => docToProduct({ ...doc, name: target.name, price: target.price }));
    expect(reset?.name).toBe(target.name);
    expect(reset?.local).toBeUndefined();
    await recountTaxonomy(db);
    invalidateTaxonomy();
    expect((await getTaxonomy()).categoryProductCount.get(target.categoryId)).toBeGreaterThan(0);
  });
});
