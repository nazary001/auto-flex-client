/** Products are chunked into sitemaps of this size (Google allows up to 50 000 URLs per file). */
export const PRODUCTS_PER_SITEMAP = 20_000;

/** Number of sitemap files: 0 = static pages + taxonomy, 1..N = product chunks. */
export function sitemapCount(totalProducts: number): number {
  return Math.ceil(totalProducts / PRODUCTS_PER_SITEMAP) + 1;
}
