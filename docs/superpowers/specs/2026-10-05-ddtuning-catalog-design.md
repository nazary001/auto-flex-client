# Catalog v2 — the AutoFlex storefront on the DD Tuning supplier feed

Date: 2026-10-05. Status: approved (owner: "переделай сайт под этот токен, категории и т.д., загрузи весь товар").
Builds on `2026-10-05-admin-panel-design.md`.

## 0. What the supplier API gives (verified with the owner's token)

Base `https://ddaudio.com.ua/api` (also `https://ddtuning.com.ua/api`), header `Authorization: Bearer <DDTUNING_API_TOKEN>`.

| endpoint | notes |
| --- | --- |
| `GET /categories?lang=ua` | 22 groups × 236 leaves, `{ data: { [groupId]: { title, children: { [leafId]: title } } } }`. Titles are Russian in both languages. |
| `GET /price/retail?lang=ua&offset=&limit=` | 103 658 items, max 10 000 per page. Retail prices in UAH. Titles/kits Ukrainian with `lang=ua`; attributes (material, installation, country, color) Russian. |
| `GET /price/wholesale?offset=&limit=` | same ids; cost price in EUR / USD / UAH or empty (`price: 0`). Ids repeat when a product sits in several warehouses. Extra field `coefficient`. |
| `GET /warehouses` | warehouse names. |

Item fields: `id` (unique), `sku` (NOT unique), `mark`, `model` ("Citroen C-2 2003-2009 гг.", "Peugeot 301 2012- гг.", "Универсальные"), `title`, `category`, `subcategory` (titles, sometimes a leaf title in `category` with empty `subcategory`), `images[]` (hosts `ddaudio.com.ua`, `media.ddaudio.com.ua`), `manufacturer`, `country`, `material`, `installation`, `kit`, `color`, `type`, `place`, `price`, `currency`, `quantity`, `available_in_stock`, `warehouse` ("В ДОРОЗІ …" = in transit, "… (Уточняти наявність)" = on request), `sale_price` + `sale_start_at`/`sale_end_at`, `short_title` + `parent: { id, title }` for variants (47 % of items; a parent never spans two car models; groups of 1–6).

Exchange rates: NBU public JSON `https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=EUR&json` (and USD).

## 1. Decisions

1. **MongoDB is the catalog.** Products, categories, brands, makes and models live in collections; the storefront queries them (indexes + aggregations). The static demo generator in `src/data` is kept only as an offline demo source (imported into the same collections when there is no supplier token).
2. **One storefront product per variant group.** A supplier `parent` group becomes one product with `option` = the variants (`short_title` → value label, `priceDelta` = variant price − base price, per-variant stock/images/supplier ids kept on the value). Standalone items become products with one supplier item. Supplier product identity = `id`; our product id = `dd-<id>` (standalone) or `dd-g<parentId>` (group).
3. **Supplier data is stored compactly on the product** (`supplierItems[]`, ~0.7 KB per item) so prices, stock and text can be recomputed from it at any time (rate change, markup change, "reset my edits") without calling the API. Admin edits are stored as `local` overrides and re-applied after every sync; effective fields are always materialised on the document for querying.
4. **Ukrainian storefront.** Category names come from a hand-written map `src/data/ddtuning/category-names.uk.ts` (supplier id → Ukrainian), attribute values through small dictionaries; product titles/kits arrive in Ukrainian from the API. Models drop "гг.".
5. **Prices.** Default `price = supplier retail (UAH)` (active `sale_price` → `price`, retail → `oldPrice`, badge `sale`), optional global markup and rounding from settings. `costPrice = wholesale × NBU rate` (EUR/USD) or wholesale UAH; unknown when the supplier has no wholesale row. Margin in the admin uses it.
6. **Stock.** `quantity > 0` → `in_stock` (`≤ 2` → `low_stock`); `quantity = 0` and warehouse "В ДОРОЗІ…" or "(Уточняти наявність)" → `preorder`; otherwise `out_of_stock`. Group product stock = best of its variants; out-of-stock variants are disabled in the selector and rejected at checkout.
7. **Sync is resumable and idempotent**: phases `rates → categories → wholesale → retail(staging) → build → taxonomy → offers → finalize`, state in `sync_runs`, each phase works in pages/batches and can continue in the next invocation (Vercel cron with a time budget) or run to completion in one Server Action locally. Products not seen in a completed run are marked `retired` + hidden (never deleted: orders reference them).

## 2. Data model (`src/lib/catalog/types.ts` + `src/lib/server/db/collections.ts`)

```ts
// storefront types (src/lib/types.ts) — additive changes
ProductOptionValue { id; label; priceDelta; stock?: StockStatus; image?: string; sku?: string }   // + per-variant data
Product { …existing…; brandName; categoryName; illustration; groupId? /* top category id */; markName?; modelName?; rating; reviewsCount }

// products collection — effective Product fields at top level, plus:
ProductDoc = Doc<Product> & {
  source: "ddtuning" | "manual" | "demo";
  hidden: boolean;            // retired or hidden by the admin; never shown on the storefront
  retired?: boolean;
  stockRank: 0|1|2|3;         // in_stock, low_stock, preorder, out_of_stock — for sorting
  search: string;             // folded name + sku(s) + brand + make/model + category, for $text
  skus: string[];             // every supplier sku in the group (exact search)
  supplier?: { code: "DDT"; groupId?: number; items: SupplierItem[]; syncedAt: string; costPrice?: number; costCurrency?: "EUR"|"USD"|"UAH"; costOriginal?: number };
  local?: ProductLocal;       // admin overrides: name, slug, price|markupPercent, oldPrice, stock, description, shortDescription, specs, images, badges, categoryId, brandId, deliveryDays, warrantyMonths, popularity
  createdAt; updatedAt;
}
SupplierItem { id; sku; title; short?; price; salePrice?; saleStart?; saleEnd?; qty; warehouse?; images: string[]; manufacturer?; country?; material?; installation?; kit?; color?; type?; place?; cost?: { amount; currency } }

categories { _id: slug; slug; name; nameRu?; parentId; illustration; icon?; description?; supplierIds: number[]; productCount; sort; hidden; local? }
brands     { _id: slug; slug; name; country; description; popular; productCount; hidden; local? }
makes      { _id: slug; slug; name; country; popular; productCount }
models     { _id: `${makeId}-${slug}`; slug; makeId; name; yearFrom; yearTo; body; productCount; supplierNames: string[] }
sync_runs  { _id; supplier: "DDT"; status: "running"|"done"|"failed"|"cancelled"; phase; offset; startedAt; updatedAt; finishedAt?; rates; counters{…}; log: {at, text}[]; error? }
dd_staging { _id: itemId; parentId: number|null; raw: retail item (+ cost) }   // transient, per run
```

Indexes: products `{slug}` unique, `{hidden, groupId, stockRank, popularity}`, `{hidden, categoryId, stockRank, price}`, `{hidden, brandId}`, `{hidden, "fitment.modelId"}`, `{hidden, "fitment.makeId"}`, `{skus}`, `{hidden, createdAt}`, `{source}`, text index `{ search: "text", name: "text" }` (`default_language: "none"`, weights name 5 / search 1); categories `{parentId, sort}`; models `{makeId, name}`.

The `catalog_products/brands/categories` overlay collections and `ensureCatalog()` are removed.

## 3. Catalog API (`src/lib/catalog.ts`, all async)

Same names as today, now returning Promises and reading MongoDB:
`getCategories, getTopCategories, getCategory, getSubcategories, getCategoryPath, getCategoryProductCount, getBrands, getBrand, getBrandById, getBrandProductCount, getMakes, getMake, getMakeById, getModels, getModel, getModelById, modelYears (sync), getMakeProductCount, getModelProductCount, getProduct, getProductById, queryProducts, getNewProducts, getSaleProducts, getPopularProducts, getRelatedProducts, getReviews, getCategoriesForVehicle, searchCatalog` plus `countProducts()`, `listProductSlugs(offset, limit)` (sitemap) and `getVariantSiblings` is unnecessary (variants are one product).

Taxonomy (categories, brands, makes, models — a few thousand small docs) is loaded into a per-process cache with a 60 s TTL (`src/lib/server/catalog/taxonomy-cache.ts`, `invalidateTaxonomy()`); products are always queried. `queryProducts` = one `$match` (hidden:false + filters; `$text` for `q`) → facets via parallel aggregations (brands without the brand filter, leaf categories, price range without the price filter, in-stock count without the stock filter) → sorted page. `searchCatalog` = `$text` ranked by `textScore` + exact/prefix sku match first.

`toCardData` stays synchronous (brandName / categoryName / illustration are denormalised on the product).

## 4. Sync (`src/lib/server/suppliers/ddtuning/`)

- `client.ts` — fetch with timeout/retry; `fetchCategories`, `fetchPricePage(kind, offset, limit)`, `fetchWarehouses`.
- `rates.ts` — NBU rates with settings fallback/override.
- `mapping.ts` — pure: `parseModel("Peugeot 301 2012- гг.") → { make: "Peugeot", model: "301", yearFrom: 2012, yearTo: null }`, `slugify`, `stockFor(item)`, `priceFor(item, policy)`, `costFor(item, rates)`, `specsFor(item)`, `descriptionFor(...)`, `translate*` dictionaries, `buildProduct(group: SupplierItem[], ctx) → ProductDoc fields`, `resolveCategory(title, subtitle)`.
- `sync.ts` — `runDdTuningSync({ budgetMs, log })` implementing the phases of §1.7; writes `sync_runs`; at the end recomputes `productCount`s, upserts offers for the DDT supplier (`sku = "DD-<itemId>"`, `productId = our id`, cost, availability), invalidates caches and calls `revalidatePath("/", "layout")`.
- `demo-import.ts` — imports the static generator catalog (`source: "demo"`) when the products collection is empty and no token is configured (dev/test).
- Triggers: admin page `/admin/supplier` (button + live progress + history + pricing policy + rates) and `GET /api/cron/ddtuning-sync` (header `x-cron-secret` / `Authorization: Bearer CRON_SECRET`, 240 s budget, continues an unfinished run).

Settings additions (`settings.supplier`): `priceSource: "retail"|"cost_markup"`, `markupPercent`, `roundTo`, `rates: { EUR, USD, updatedAt, source: "nbu"|"manual" }`, `autoSyncEnabled`.

## 5. Storefront changes

- Every consumer awaits the async catalog (24 files + Header/CategorySidebar/VehicleBar/ProductListing). `product/[slug]`: no `generateStaticParams`, `revalidate = 600`; BuyBox disables out-of-stock variant values and swaps the gallery to the variant image when present. `sitemap.ts` → `generateSitemaps` (20 000 URLs each). Category icons for the 22 supplier groups (`src/components/icons`). Blog `relatedCategories` tolerate missing slugs.
- Content refresh for the new assortment (accessories & tuning, not spare parts): blog articles, FAQ, promos (new hrefs), `site.ts` copy, info pages mentioning "запчастини".
- `/api/orders`: validates the chosen variant's stock, records the variant sku and cost on the line.

## 6. Admin changes

- Products list/editor read the products collection (DB paging, filters: source, hidden, in stock, category, brand, make, has cost, edited), inline price/stock edits write `local`, "Скинути зміни" clears `local` and rebuilds from `supplier.items`; the editor shows the variants table (sku, qty, warehouse, cost, price) and supplier meta.
- Categories/brands editors write `local` name/description/icon/illustration on the docs; counts come from the docs.
- New page `/admin/supplier` (nav: Система → Постачальник DD).
- Seed: demo orders sample products from the collection.

## 7. Phases

A (core, single author): spec, types, collections/indexes, taxonomy cache, catalog v2, mapping + tests, sync + demo import, settings, `/api/orders`, seed. B (parallel agents): storefront migration; admin adaptation + supplier page; content; query tests. C: integration, full import of the 103 658 items into the local DB, browser verification.

## 8. Status (2026-10-05, after phase C)

Implemented as designed; the full feed is imported into the development database (103 658 items →
87 035 products / 8 995 variant groups, 267 categories, 57 brands, 100 makes, 1 864 models,
62 334 offers with cost). Deviations and additions found during integration:

- **Sitemap index.** Next.js reserves `/sitemap.xml` for `app/sitemap.ts` even with
  `generateSitemaps` (a route handler there conflicts), so the index lives at
  `/sitemap-index.xml` (`src/app/sitemap-index.xml/route.ts`) and `robots.ts` points to it.
- **Shared local MongoDB.** The data directory lock is single-process. The running instance writes
  `data/local-mongo.json` (uri + pid); any other process (build workers, the separate module
  context Next.js uses for metadata routes, scripts) connects to it instead of starting a second
  mongod. `next build` with `ALLOW_LOCAL_DB=true` therefore works next to `next dev`.
- **Turbopack tracing.** `path.resolve(process.cwd(), …)` for the data directory must carry
  `/* turbopackIgnore: true */`, otherwise the whole directory (with locked WiredTiger files) is
  traced into the build output; the same comment is on the dynamic import of
  `mongodb-memory-server`.
- **Placeholder costs.** The wholesale list prices some lines (forged wheels, body kits…) at a
  token 1 USD / 1 EUR; `isRealCost()` ignores them, the offers phase deletes stale offers of
  lines without a real cost.
- **Category illustrations.** 22 group illustrations are generated from the group icons
  (`public/illustrations/dd-<icon>.svg`, same canvas and palette as the hand-drawn ones);
  leaves inherit the group illustration; the sync assigns them (`illustrationFor`).
- **Supplier page** shows the last finished run when nothing is running.

Known data quirks (supplier side, left as is): a dozen trims priced 45–90 k UAH in the retail
list, two "extra warranty" pseudo-products.
