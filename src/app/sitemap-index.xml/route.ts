import { catalogLastSyncAt, countProducts, productChunkLastmod } from "@/lib/catalog";
import { site } from "@/lib/site";
import { PRODUCTS_PER_SITEMAP, sitemapCount } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

/**
 * Sitemap index: /sitemap/0.xml (static pages + taxonomy) and the product chunks, each with an honest
 * <lastmod> (last catalog sync for the taxonomy, newest product change inside a chunk). Also served
 * at /sitemap.xml through the rewrite in next.config.ts — the address crawlers and Search Console expect.
 */
export async function GET(): Promise<Response> {
  const [total, lastSync] = await Promise.all([countProducts(), catalogLastSyncAt()]);
  const count = sitemapCount(total);
  const chunkDates = await Promise.all(
    Array.from({ length: count - 1 }, (_, chunk) => productChunkLastmod(chunk * PRODUCTS_PER_SITEMAP, PRODUCTS_PER_SITEMAP)),
  );
  const fallback = new Date().toISOString();
  const dates = [lastSync ?? chunkDates.find(Boolean) ?? fallback, ...chunkDates.map((date) => date ?? lastSync ?? fallback)];

  const entries = dates
    .map((lastmod, id) => {
      const iso = new Date(lastmod).toISOString();
      return `  <sitemap><loc>${site.url}/sitemap/${id}.xml</loc><lastmod>${iso}</lastmod></sitemap>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
