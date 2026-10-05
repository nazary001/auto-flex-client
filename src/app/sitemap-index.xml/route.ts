import { countProducts } from "@/lib/catalog";
import { site } from "@/lib/site";
import { sitemapCount } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

/**
 * Sitemap index. app/sitemap.ts splits the catalog into files that Next.js serves at /sitemap/<id>.xml
 * but does not list anywhere (and it reserves /sitemap.xml itself), so robots.txt points crawlers here.
 */
export async function GET(): Promise<Response> {
  const count = sitemapCount(await countProducts());
  const lastmod = new Date().toISOString();
  const entries = Array.from(
    { length: count },
    (_, id) => `  <sitemap><loc>${site.url}/sitemap/${id}.xml</loc><lastmod>${lastmod}</lastmod></sitemap>`,
  ).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
