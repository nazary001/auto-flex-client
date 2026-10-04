import type { ProductSort } from "@/lib/types";

/*
 * Shared query-parameter contract for every product listing (catalog, avto,
 * brands, search). Pure, server-safe and free of catalog imports, so both
 * Server Components and the interactive Client Components can use it.
 *
 * URL params: brand=<slugs, comma separated> · min · max · instock=1 · sale=1
 *             category=<slug> · sort=popular|price_asc|price_desc|new|rating
 *             page=<n> · q=<text>
 *
 * Brand slugs are mapped to ids with getBrand() where the query is built
 * (see ProductListing); this module keeps only string/number state.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

export const PER_PAGE = 24;

export const DEFAULT_SORT: ProductSort = "popular";

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "popular", label: "Популярні" },
  { value: "price_asc", label: "Дешевші" },
  { value: "price_desc", label: "Дорожчі" },
  { value: "new", label: "Новинки" },
  { value: "rating", label: "За рейтингом" },
];

const SORT_VALUES = new Set<ProductSort>(SORT_OPTIONS.map((o) => o.value));

/** Parsed, validated listing state read from the URL. */
export interface ListingState {
  /** Raw brand slugs, order preserved, de-duplicated */
  brandSlugs: string[];
  min?: number;
  max?: number;
  inStock: boolean;
  sale: boolean;
  /** Only meaningful where the category facet is enabled */
  categorySlug?: string;
  sort: ProductSort;
  /** 1-based, always ≥ 1 */
  page: number;
  q?: string;
}

/** Patch applied to the URL; a key omitted is left as-is, a nullish/false value removes it. */
export interface ListingPatch {
  brand?: string[] | null;
  min?: number | null;
  max?: number | null;
  instock?: boolean;
  sale?: boolean;
  category?: string | null;
  sort?: ProductSort;
  page?: number;
  q?: string | null;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toInt(value: string | undefined): number | undefined {
  if (value == null) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseListingParams(sp: RawSearchParams): ListingState {
  const brandRaw = sp.brand;
  const brandValues = Array.isArray(brandRaw) ? brandRaw : brandRaw ? [brandRaw] : [];
  const brandSlugs = [
    ...new Set(
      brandValues
        .flatMap((v) => v.split(","))
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];

  let min = toInt(first(sp.min));
  let max = toInt(first(sp.max));
  if (min != null && max != null && min > max) [min, max] = [max, min];

  const sortRaw = first(sp.sort) as ProductSort | undefined;
  const sort = sortRaw && SORT_VALUES.has(sortRaw) ? sortRaw : DEFAULT_SORT;

  return {
    brandSlugs,
    min,
    max,
    inStock: first(sp.instock) === "1",
    sale: first(sp.sale) === "1",
    categorySlug: first(sp.category)?.trim() || undefined,
    sort,
    page: Math.max(1, toInt(first(sp.page)) ?? 1),
    q: first(sp.q)?.trim() || undefined,
  };
}

/** How many filters are active — drives the mobile «Фільтри» badge and the empty state. */
export function activeFilterCount(state: ListingState, categoryFacet = false): number {
  return (
    state.brandSlugs.length +
    (state.min != null || state.max != null ? 1 : 0) +
    (state.inStock ? 1 : 0) +
    (state.sale ? 1 : 0) +
    (categoryFacet && state.categorySlug ? 1 : 0)
  );
}

/** Any param that turns the page into a filtered/sorted/paginated variant (→ robots noindex, follow). */
export function hasListingParams(sp: RawSearchParams): boolean {
  return ["brand", "min", "max", "instock", "sale", "category", "sort", "page"].some((k) => {
    const v = sp[k];
    return Array.isArray(v) ? v.length > 0 : v != null && v !== "";
  });
}

/**
 * Builds an href from the current params plus a patch. Changing any filter or
 * sort resets `page`; `q` and unknown params are preserved.
 */
export function buildListingHref(pathname: string, current: RawSearchParams, patch: ListingPatch): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (value == null) continue;
    const v = Array.isArray(value) ? value.join(",") : value;
    if (v !== "") params.set(key, v);
  }

  const put = (key: string, value: string | undefined) => {
    if (value == null || value === "") params.delete(key);
    else params.set(key, value);
  };

  if ("brand" in patch) put("brand", patch.brand && patch.brand.length ? patch.brand.join(",") : undefined);
  if ("min" in patch) put("min", patch.min != null ? String(patch.min) : undefined);
  if ("max" in patch) put("max", patch.max != null ? String(patch.max) : undefined);
  if ("instock" in patch) put("instock", patch.instock ? "1" : undefined);
  if ("sale" in patch) put("sale", patch.sale ? "1" : undefined);
  if ("category" in patch) put("category", patch.category || undefined);
  if ("sort" in patch) put("sort", patch.sort && patch.sort !== DEFAULT_SORT ? patch.sort : undefined);
  if ("q" in patch) put("q", patch.q || undefined);
  if ("page" in patch) put("page", patch.page && patch.page > 1 ? String(patch.page) : undefined);

  // Any change other than paging returns to page 1.
  if (patch.page === undefined && Object.keys(patch).some((k) => k !== "page")) params.delete("page");

  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Patch that clears every filter but keeps sort and q. */
export const RESET_FILTERS_PATCH: ListingPatch = {
  brand: null,
  min: null,
  max: null,
  instock: false,
  sale: false,
  category: null,
};

const OWNED_PARAMS = new Set(["brand", "min", "max", "instock", "sale", "category", "sort", "page"]);

/**
 * Serializes a full listing state to an href, preserving q and any unknown
 * params. Used by the filter panel, which drives the URL from an optimistic
 * copy of the state so rapid toggles accumulate instead of racing.
 */
export function hrefFromState(pathname: string, current: RawSearchParams, state: ListingState): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (OWNED_PARAMS.has(key) || value == null) continue;
    const v = Array.isArray(value) ? value.join(",") : value;
    if (v !== "") params.set(key, v);
  }
  if (state.brandSlugs.length) params.set("brand", state.brandSlugs.join(","));
  if (state.min != null) params.set("min", String(state.min));
  if (state.max != null) params.set("max", String(state.max));
  if (state.inStock) params.set("instock", "1");
  if (state.sale) params.set("sale", "1");
  if (state.categorySlug) params.set("category", state.categorySlug);
  if (state.sort !== DEFAULT_SORT) params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
