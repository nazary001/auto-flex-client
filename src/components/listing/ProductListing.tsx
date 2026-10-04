import type { ReactNode } from "react";
import { ProductGrid } from "@/components/product/ProductGrid";
import { Pagination } from "@/components/ui/Pagination";
import { ActiveFilters, type FilterChip } from "@/components/listing/ActiveFilters";
import { ListingEmpty } from "@/components/listing/ListingEmpty";
import { ListingFilters } from "@/components/listing/ListingFilters";
import { ListingProvider } from "@/components/listing/ListingProvider";
import { ListingToolbar } from "@/components/listing/ListingToolbar";
import { ResultsRegion } from "@/components/listing/ResultsRegion";
import {
  activeFilterCount,
  parseListingParams,
  PER_PAGE,
  type RawSearchParams,
} from "@/components/listing/params";
import { toCardData } from "@/lib/card";
import { getBrand, getCategory, getMakeById, getModelById, queryProducts } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { site } from "@/lib/site";
import type { ProductQuery } from "@/lib/types";

export interface ProductListingProps {
  /** Route path used to build filter/sort/pagination hrefs, e.g. "/catalog/halmivni-kolodky" */
  pathname: string;
  /** Awaited searchParams of the page */
  searchParams: RawSearchParams;
  /** Fixed query constraints from the route (categoryId / makeId / modelId / includeUniversal / q / badge) */
  base?: Partial<ProductQuery>;
  /** Which facet filters to offer */
  facets?: { brands?: boolean; categories?: boolean };
  /** Product grid columns (3 alongside a sidebar, 4 full width) */
  columns?: 3 | 4;
  /** Rendered above the desktop filter panel (e.g. <CategorySidebar/>) */
  sidebar?: ReactNode;
  /** Replaces the default empty state when there are no results */
  empty?: ReactNode;
  /** Emit ItemList JSON-LD for the products on this page (indexable listings only) */
  emitItemList?: boolean;
  /** Extra classes on the outer wrapper */
  className?: string;
}

/**
 * Self-contained product listing: toolbar (count + sort + mobile filters),
 * removable active-filter chips, a filter panel (desktop sidebar / mobile
 * drawer), the product grid and pagination. Reads its state from `searchParams`
 * so it is correct when server-rendered from a direct URL, and updates the URL
 * client-side (without losing scroll) when a filter changes.
 */
export function ProductListing({
  pathname,
  searchParams,
  base = {},
  facets,
  columns = 3,
  sidebar,
  empty,
  emitItemList = false,
  className,
}: ProductListingProps) {
  const showBrands = facets?.brands ?? true;
  const showCategories = facets?.categories ?? false;

  const state = parseListingParams(searchParams);

  const brandIds = state.brandSlugs.map((slug) => getBrand(slug)?.id).filter((id): id is string => Boolean(id));
  const selectedCategory =
    showCategories && state.categorySlug && getCategory(state.categorySlug) ? state.categorySlug : undefined;

  const query: ProductQuery = {
    ...base,
    categoryId: selectedCategory ?? base.categoryId,
    // URL brand filter (when the facet is on) overrides the route's fixed brand(s)
    brandIds: brandIds.length > 0 ? brandIds : base.brandIds,
    priceMin: state.min,
    priceMax: state.max,
    inStockOnly: state.inStock || undefined,
    badge: state.sale ? "sale" : base.badge,
    q: base.q ?? state.q,
    sort: state.sort,
    page: state.page,
    perPage: PER_PAGE,
  };

  const result = queryProducts(query);

  // Category facet counts are computed without the user-selected category so the
  // list stays stable and the buyer can switch between categories.
  const categoryFacets = showCategories
    ? queryProducts({ ...query, categoryId: base.categoryId, page: 1 }).facets.categories
    : [];

  // A product is named after its primary vehicle, which may be a platform sibling of the
  // car being browsed — so on vehicle listings each card says which of the buyer's models it fits.
  const make = query.makeId ? getMakeById(query.makeId) : undefined;
  const items = result.items.map((product) => {
    const card = toCardData(product);
    if (!make) return card;
    const models = product.fitment
      .filter((f) => f.makeId === make.id && (!query.modelId || f.modelId === query.modelId))
      .map((f) => getModelById(f.modelId)?.name)
      .filter((name): name is string => Boolean(name));
    return models.length > 0 ? { ...card, fitLabel: `${make.name} ${[...new Set(models)].join(", ")}` } : card;
  });
  const activeCount = activeFilterCount(state, showCategories);

  // ── active-filter chips (labels resolved here on the server) ──
  const chips: FilterChip[] = [];
  for (const slug of state.brandSlugs) {
    const brand = getBrand(slug);
    if (!brand) continue;
    chips.push({
      key: `brand-${slug}`,
      label: brand.name,
      patch: { brand: state.brandSlugs.filter((s) => s !== slug) },
    });
  }
  if (state.min != null || state.max != null) {
    const label =
      state.min != null && state.max != null
        ? `${formatNumber(state.min)}–${formatNumber(state.max)} ₴`
        : state.min != null
          ? `від ${formatNumber(state.min)} ₴`
          : `до ${formatNumber(state.max!)} ₴`;
    chips.push({ key: "price", label, patch: { min: null, max: null } });
  }
  if (state.inStock) chips.push({ key: "instock", label: "В наявності", patch: { instock: false } });
  if (state.sale) chips.push({ key: "sale", label: "Зі знижкою", patch: { sale: false } });
  if (selectedCategory) {
    const category = getCategory(selectedCategory);
    if (category) chips.push({ key: "category", label: category.name, patch: { category: null } });
  }

  const filterPanel =
    showBrands || showCategories ? (
      <ListingFilters
        pathname={pathname}
        searchParams={searchParams}
        state={state}
        brands={showBrands ? result.facets.brands : []}
        categories={categoryFacets}
        priceRange={result.facets.priceRange}
        inStockCount={result.facets.inStockCount}
        showBrands={showBrands}
        showCategories={showCategories}
      />
    ) : null;

  const hasAside = Boolean(sidebar || filterPanel);

  const itemListJsonLd =
    emitItemList && result.items.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: result.items.map((product, index) => ({
            "@type": "ListItem",
            position: (result.page - 1) * result.perPage + index + 1,
            url: new URL(`/product/${product.slug}`, site.url).toString(),
            name: product.name,
          })),
        }
      : null;

  return (
    <ListingProvider pathname={pathname} searchParams={searchParams}>
      <div className={cn(hasAside && "lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8", className)}>
        {hasAside && (
          <aside className="hidden lg:block">
            <div className="grid gap-5">
              {sidebar}
              {filterPanel && (
                <div className="card overflow-hidden">
                  <p className="border-b border-line-soft px-4 py-3 text-[15px] font-semibold text-ink">Фільтри</p>
                  <div className="p-4">{filterPanel}</div>
                </div>
              )}
            </div>
          </aside>
        )}

        <div className="min-w-0">
          <ListingToolbar
            sort={state.sort}
            total={result.total}
            filterPanel={filterPanel}
            activeCount={activeCount}
          />

          {chips.length > 0 && <ActiveFilters chips={chips} className="mt-4" />}

          {result.total > 0 ? (
            <ResultsRegion className="mt-5">
              <ProductGrid products={items} columns={columns} />
              <Pagination
                page={result.page}
                pageCount={result.pageCount}
                pathname={pathname}
                query={searchParams}
                className="mt-8"
              />
            </ResultsRegion>
          ) : (
            <div className="mt-6">
              {empty ?? (
                <ListingEmpty pathname={pathname} searchParams={searchParams} hasFilters={activeCount > 0} />
              )}
            </div>
          )}
        </div>
      </div>

      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd).replace(/</g, "\\u003c") }}
        />
      )}
    </ListingProvider>
  );
}
