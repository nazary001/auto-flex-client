import { describe, expect, it } from "vitest";
import {
  buildProduct,
  costUah,
  makeSlugOf,
  modelSlugOf,
  parseModel,
  isRealCost,
  pickBestCost,
  priceFor,
  stockFor,
  toSupplierItem,
  variantCost,
  type BuildContext,
} from "@/lib/server/suppliers/ddtuning/mapping";
import type { RawItem } from "@/lib/server/suppliers/ddtuning/client";
import { LEAF_NAMES_UK, GROUP_NAMES_UK } from "@/data/ddtuning/category-names.uk";
import { activeSale, applyLocalOverrides, roundPrice } from "@/lib/server/catalog/product-doc";

const rates = { EUR: 50, USD: 45 };

function raw(over: Partial<RawItem> = {}): RawItem {
  return {
    id: 538,
    mark: "Citroen",
    model: "Citroen C-3 2002-2009 гг.",
    title: "Накладки на ручки (нерж) 4 шт, Carmos - Турецька сталь",
    category: "Хром накладки",
    subcategory: "Накладки на ручки",
    images: ["https://media.ddaudio.com.ua/a.jpg", "https://ddaudio.com.ua/b.jpg"],
    manufacturer: "Carmos",
    country: "Турция",
    material: "Нержавеющая сталь",
    installation: "Самоклейка",
    kit: "4 накладки",
    color: "Хром",
    sku: "car8131",
    price: 861,
    currency: "UAH",
    quantity: 4,
    available_in_stock: 4,
    warehouse: "Основной",
    short_title: "4 шт, Carmos - Турецька сталь",
    parent: { id: 24750, title: "Накладки на ручки (нерж)" },
    ...over,
  };
}

const ctx: BuildContext = {
  rates,
  policy: { priceSource: "retail", markupPercent: 0, roundTo: 0 },
  now: "2026-10-05T12:00:00.000Z",
  resolveCategory: (category, sub) => ({ id: `leaf-${sub || category}`, groupId: `group-${category}`, name: sub || category, illustration: "_fallback" }),
  resolveBrand: (m) => ({ id: (m ?? "other").toLowerCase(), name: m ?? "Інші" }),
  resolveVehicle: (parsed) =>
    parsed.universal
      ? { universal: true, fitment: [] }
      : {
          universal: false,
          fitment: [{ makeId: makeSlugOf(parsed.makeName), modelId: `${makeSlugOf(parsed.makeName)}-${modelSlugOf(parsed)}`, years: "2002–2009" }],
          markName: parsed.makeName,
          modelName: parsed.modelName,
        },
};

describe("parseModel", () => {
  it("splits mark, model and years", () => {
    expect(parseModel("Citroen", "Citroen C-3 2002-2009 гг.")).toEqual({ universal: false, makeName: "Citroen", modelName: "C-3", yearFrom: 2002, yearTo: 2009 });
    expect(parseModel("Peugeot", "Peugeot 301 2012- гг.")).toMatchObject({ modelName: "301", yearFrom: 2012, yearTo: null });
    expect(parseModel("Alfa Romeo", "Alfa Romeo 159 2005–2011 гг.")).toMatchObject({ modelName: "159", yearFrom: 2005, yearTo: 2011 });
    expect(parseModel("ИЖ", "ИЖ 2126 1990–2005")).toMatchObject({ modelName: "2126", yearFrom: 1990, yearTo: 2005 });
    expect(parseModel("Toyota", "Toyota HiAce")).toMatchObject({ modelName: "HiAce", yearFrom: null });
    expect(parseModel("Volkswagen", "Volkswagen")).toMatchObject({ modelName: "Усі моделі" });
    expect(parseModel("Универсальные", "Универсальные").universal).toBe(true);
  });

  it("derives stable slugs", () => {
    const parsed = parseModel("LandRover Range Rover", "LandRover Range Rover Sport 2013-2022 гг.");
    expect(makeSlugOf(parsed.makeName)).toBe("landrover-range-rover");
    expect(modelSlugOf(parsed)).toBe("sport-2013");
    expect(modelSlugOf(parseModel("Ford", "Ford"))).toBe("all");
  });
});

describe("stock, prices and costs", () => {
  it("maps warehouse quantities to stock statuses", () => {
    expect(stockFor({ qty: 5 })).toBe("in_stock");
    expect(stockFor({ qty: 1 })).toBe("in_stock");
    expect(stockFor({ qty: 0, warehouse: "В ДОРОЗІ Omsa Line" })).toBe("preorder");
    expect(stockFor({ qty: 0, warehouse: "Stingray (Уточняти наявність)" })).toBe("preorder");
    expect(stockFor({ qty: 0 })).toBe("out_of_stock");
  });

  it("applies sales, markups and rounding", () => {
    const item = toSupplierItem(raw({ price: 824, sale_price: 800, sale_start_at: "2026-10-01", sale_end_at: "2026-10-11" }));
    const today = new Date("2026-10-05T00:00:00Z");
    expect(activeSale(item, today)).toBe(true);
    expect(priceFor(item, { priceSource: "retail", markupPercent: 0, roundTo: 0 }, rates, today)).toEqual({ price: 800, oldPrice: 824, sale: true });
    expect(priceFor(item, { priceSource: "retail", markupPercent: 10, roundTo: 0 }, rates, today)).toEqual({ price: 880, oldPrice: 910, sale: true });
    expect(priceFor(item, { priceSource: "retail", markupPercent: 0, roundTo: 0 }, rates, new Date("2026-11-01T00:00:00Z"))).toEqual({ price: 824, sale: false });
    const costed = toSupplierItem(raw(), { price: 10, currency: "EUR", quantity: 1 });
    expect(costUah(costed, rates)).toBe(500);
    expect(priceFor(costed, { priceSource: "cost_markup", markupPercent: 30, roundTo: 10 }, rates)).toEqual({ price: 650, sale: false });
    expect(roundPrice(1234)).toBe(1240);
    expect(roundPrice(333)).toBe(335);
  });

  it("picks the cheapest in-stock wholesale row", () => {
    const best = pickBestCost(
      [
        { price: 20, currency: "EUR", quantity: 0 },
        { price: 30, currency: "USD", quantity: 2 },
        { price: 1300, currency: "UAH", quantity: 1 },
        { price: 0, currency: "", quantity: 0 },
      ],
      rates,
    );
    expect(best).toEqual({ price: 1300, currency: "UAH", quantity: 1 });
  });
});

describe("buildProduct", () => {
  it("groups variants into one product with an option", () => {
    const a = toSupplierItem(raw({ id: 538, price: 861, quantity: 0, warehouse: "" }), { price: 12, currency: "EUR", quantity: 0 });
    const b = toSupplierItem(raw({ id: 539, price: 677, quantity: 3, short_title: "2 шт, Carmos - Турецька сталь", sku: "car8132" }), { price: 9, currency: "EUR", quantity: 3 });
    const built = buildProduct(
      { items: [a, b], parentId: 24750, parentTitle: "Накладки на ручки (нерж)", mark: "Citroen", model: "Citroen C-3 2002-2009 гг.", category: "Хром накладки", subcategory: "Накладки на ручки" },
      ctx,
    );
    const p = built.product;
    expect(p.id).toBe("dd-g24750");
    expect(p.name).toBe("Накладки на ручки (нерж) Citroen C-3");
    expect(p.slug).toMatch(/^nakladky-na-ruchky-nerzh-citroen-c-3-g24750$/);
    expect(p.price).toBe(677); // the in-stock variant is the base
    expect(p.stock).toBe("in_stock");
    expect(p.option?.values.map((v) => [v.id, v.priceDelta, v.stock])).toEqual([
      ["v539", 0, "in_stock"],
      ["v538", 184, "out_of_stock"],
    ]);
    expect(p.images).toHaveLength(2);
    expect(p.fitment[0].modelId).toBe("citroen-c-3-2002");
    expect(p.specs.find((s) => s.name === "Матеріал")?.value).toBe("Нержавіюча сталь");
    expect(p.brandName).toBe("Carmos");
    expect(built.skus).toEqual(["car8132", "car8131"]);
    expect(built.supplier.costPrice).toBe(450);
    expect(variantCost({ supplier: built.supplier, option: p.option, sku: p.sku }, "v538", rates)).toEqual({ sku: "car8131", costPrice: 600 });
  });

  it("builds standalone and universal products", () => {
    const item = toSupplierItem(raw({ id: 9, parent: undefined, short_title: undefined, mark: "Универсальные", model: "Универсальные", category: "Автохимия", subcategory: "Автошампуни" }));
    const built = buildProduct({ items: [item], parentId: null, mark: "Универсальные", model: "Универсальные", category: "Автохимия", subcategory: "Автошампуни" }, ctx);
    expect(built.product.id).toBe("dd-9");
    expect(built.product.universal).toBe(true);
    expect(built.product.fitment).toEqual([]);
    expect(built.product.option).toBeUndefined();
    expect(built.product.shortDescription.startsWith("Універсальний аксесуар.")).toBe(true);
  });

  it("keeps admin overrides on top of supplier data", () => {
    const item = toSupplierItem(raw({ parent: undefined }));
    const built = buildProduct({ items: [item], parentId: null, mark: "Citroen", model: "Citroen C-3 2002-2009 гг.", category: "Хром накладки", subcategory: "Накладки на ручки" }, ctx);
    const edited = applyLocalOverrides(built.product, { name: "Моя назва", markupPercent: 20, badges: ["hit"] });
    expect(edited.name).toBe("Моя назва");
    expect(edited.price).toBe(roundPrice(861 * 1.2));
    expect(edited.badges).toEqual(["hit"]);
    expect(applyLocalOverrides(built.product, { price: 999, oldPrice: null }).price).toBe(999);
  });
});

describe("category names", () => {
  it("translates every supplier group and leaf the API currently returns", () => {
    expect(Object.keys(GROUP_NAMES_UK)).toHaveLength(22);
    expect(Object.keys(LEAF_NAMES_UK).length).toBeGreaterThanOrEqual(236);
    expect(GROUP_NAMES_UK[7092].name).toBe("Хром-накладки");
    expect(LEAF_NAMES_UK[34101]).toBe("Накладки на ручки");
  });
});

describe("placeholder wholesale prices", () => {
  it("ignores token costs of 1 USD / 1 EUR but keeps small real UAH costs", () => {
    expect(isRealCost({ price: 1, currency: "USD", quantity: 1 })).toBe(false);
    expect(isRealCost({ price: 1, currency: "EUR", quantity: 1 })).toBe(false);
    expect(isRealCost({ price: 1.09, currency: "USD", quantity: 1 })).toBe(true);
    expect(isRealCost({ price: 1, currency: "UAH", quantity: 1 })).toBe(true);
    expect(isRealCost({ price: 0, currency: "UAH", quantity: 1 })).toBe(false);
    expect(pickBestCost([{ price: 1, currency: "USD", quantity: 5 }], rates)).toBeUndefined();
    expect(toSupplierItem(raw(), { price: 1, currency: "USD", quantity: 1 }).cost).toBeUndefined();
  });
});
