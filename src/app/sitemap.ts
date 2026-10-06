import type { MetadataRoute } from "next";
import { articles } from "@/data/articles";
import { catalogLastSyncAt, countProducts, getBrands, getCategories, getMakes, getModels, listProductSlugs } from "@/lib/catalog";
import { site } from "@/lib/site";
import { PRODUCTS_PER_SITEMAP, sitemapCount } from "@/lib/sitemap";

type Entry = MetadataRoute.Sitemap[number];

const url = (path: string) => `${site.url}${path}`;

/** Each file is cached for an hour: crawlers re-read them often and a product chunk is 20 000 rows */
export const revalidate = 3600;

/*
 * /sitemap/0.xml — static pages + the whole taxonomy (categories, makes/models, brands, articles)
 * /sitemap/N.xml — a page of up to 20 000 product URLs, each with its main photo for Google Images
 * /sitemap.xml   — the index listing them (app/sitemap-index.xml/route.ts, rewritten in next.config.ts)
 *
 * Only visible products and the taxonomy the storefront shows are listed. Cart, checkout, account,
 * favourites, search and the back office are left out here and disallowed in robots.txt.
 */
export async function generateSitemaps(): Promise<{ id: number }[]> {
  return Array.from({ length: sitemapCount(await countProducts()) }, (_, id) => ({ id }));
}

export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const index = Number(await id);
  return index === 0 ? taxonomySitemap() : productSitemap(index - 1);
}

/** One page of product URLs (chunk is 0-based) in the stable id order the index relies on */
async function productSitemap(chunk: number): Promise<MetadataRoute.Sitemap> {
  const products = await listProductSlugs(chunk * PRODUCTS_PER_SITEMAP, PRODUCTS_PER_SITEMAP);
  return products.map((product) => ({
    url: url(`/product/${product.slug}`),
    lastModified: new Date(product.updatedAt),
    changeFrequency: "weekly",
    priority: 0.7,
    ...(product.image ? { images: [product.image] } : {}),
  }));
}

/** Static pages + the full taxonomy. Catalog-driven pages carry the last sync time; legal pages carry no date. */
async function taxonomySitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, makes, brands, lastSync] = await Promise.all([getCategories(), getMakes(), getBrands(), catalogLastSyncAt()]);
  const catalogDate = lastSync ? new Date(lastSync) : undefined;
  const dated = (entry: Entry): Entry => (catalogDate ? { ...entry, lastModified: catalogDate } : entry);

  const staticEntries: Entry[] = [
    dated({ url: url("/"), changeFrequency: "daily", priority: 1 }),
    dated({ url: url("/catalog"), changeFrequency: "daily", priority: 0.9 }),
    dated({ url: url("/avto"), changeFrequency: "weekly", priority: 0.8 }),
    dated({ url: url("/brands"), changeFrequency: "weekly", priority: 0.7 }),
    { url: url("/aktsii"), changeFrequency: "weekly", priority: 0.7 },
    { url: url("/blog"), changeFrequency: "weekly", priority: 0.6 },
    { url: url("/karta-saitu"), changeFrequency: "monthly", priority: 0.3 },
    { url: url("/oplata-i-dostavka"), changeFrequency: "monthly", priority: 0.5 },
    { url: url("/povernennia"), changeFrequency: "monthly", priority: 0.5 },
    { url: url("/harantiia"), changeFrequency: "monthly", priority: 0.5 },
    { url: url("/pro-nas"), changeFrequency: "monthly", priority: 0.5 },
    { url: url("/spivpratsia"), changeFrequency: "monthly", priority: 0.5 },
    { url: url("/kontakty"), changeFrequency: "monthly", priority: 0.5 },
    { url: url("/dohovir-oferty"), changeFrequency: "yearly", priority: 0.3 },
    { url: url("/polityka-konfidentsiinosti"), changeFrequency: "yearly", priority: 0.3 },
  ];

  const categoryEntries: Entry[] = categories.map((category) =>
    dated({
      url: url(`/catalog/${category.slug}`),
      changeFrequency: "weekly",
      priority: category.parentId ? 0.6 : 0.8,
    }),
  );

  const vehicleGroups = await Promise.all(
    makes.map(async (make): Promise<Entry[]> => {
      const models = await getModels(make.id);
      return [
        dated({ url: url(`/avto/${make.slug}`), changeFrequency: "weekly", priority: 0.6 }),
        ...models.map((model) => dated({ url: url(`/avto/${make.slug}/${model.slug}`), changeFrequency: "weekly", priority: 0.5 })),
      ];
    }),
  );

  const brandEntries: Entry[] = brands.map((brand) =>
    dated({ url: url(`/brands/${brand.slug}`), changeFrequency: "weekly", priority: 0.5 }),
  );

  const articleEntries: Entry[] = articles.map((article) => ({
    url: url(`/blog/${article.slug}`),
    lastModified: new Date(article.date),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticEntries, ...categoryEntries, ...vehicleGroups.flat(), ...brandEntries, ...articleEntries];
}
