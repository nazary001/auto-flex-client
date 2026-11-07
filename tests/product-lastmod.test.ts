import { describe, expect, it } from "vitest";
import { docToProduct, productContentHash, productToDoc } from "@/lib/server/catalog/product-doc";
import type { Product } from "@/lib/types";

const product: Product = {
  id: "p1",
  slug: "kylymky-eva-bmw-x5",
  sku: "DD-1",
  oemNumbers: [],
  name: "Килимки EVA BMW X5",
  brandId: "dd",
  categoryId: "mats",
  price: 1200,
  stock: "in_stock",
  deliveryDays: [1, 3],
  images: ["https://ddaudio.com.ua/a.jpg"],
  badges: [],
  rating: 0,
  reviewsCount: 0,
  shortDescription: "",
  description: ["Опис"],
  specs: [{ name: "Колір", value: "Чорний" }],
  fitment: [{ makeId: "bmw", modelId: "bmw-x5", years: "2013–2018" }],
  universal: false,
  warrantyMonths: 12,
  createdAt: "2026-10-01T00:00:00.000Z",
  popularity: 5,
};

const OLD = "2026-11-01T03:00:00.000Z";
const NOW = "2026-11-08T03:00:00.000Z";

describe("product updatedAt (sitemap lastmod)", () => {
  const stored = productToDoc(product, { source: "ddtuning", updatedAt: OLD });

  it("keeps the previous date when a re-sync changes nothing on the page", () => {
    const next = productToDoc({ ...product }, { source: "ddtuning", updatedAt: NOW, previous: stored });
    expect(next.updatedAt).toBe(OLD);
    expect(next.contentHash).toBe(stored.contentHash);
  });

  it("ignores key order and fields the page does not show", () => {
    const reordered = Object.fromEntries(Object.entries({ ...product, popularity: 99, createdAt: NOW }).reverse()) as unknown as Product;
    expect(productContentHash(reordered)).toBe(productContentHash(product));
    expect(productToDoc(reordered, { source: "ddtuning", updatedAt: NOW, previous: stored }).updatedAt).toBe(OLD);
  });

  it("moves the date when price, stock or photos change", () => {
    for (const changed of [{ price: 1250 }, { stock: "out_of_stock" as const }, { images: [] }, { oldPrice: 1500 }]) {
      expect(productToDoc({ ...product, ...changed }, { source: "ddtuning", updatedAt: NOW, previous: stored }).updatedAt).toBe(NOW);
    }
  });

  it("moves the date when visibility changes (retired product comes back, admin hides it)", () => {
    const retired = { ...stored, retired: true, hidden: true };
    expect(productToDoc(product, { source: "ddtuning", updatedAt: NOW, previous: retired }).updatedAt).toBe(NOW);
    expect(productToDoc(product, { source: "ddtuning", hidden: true, updatedAt: NOW, previous: stored }).updatedAt).toBe(NOW);
  });

  it("moves the date for documents stored before the hash existed", () => {
    const legacy = { ...stored, contentHash: undefined };
    expect(productToDoc(product, { source: "ddtuning", updatedAt: NOW, previous: legacy }).updatedAt).toBe(NOW);
  });

  it("never exposes the hash on the storefront product", () => {
    expect(docToProduct(stored)).not.toHaveProperty("contentHash");
  });
});
