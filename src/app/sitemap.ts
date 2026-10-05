import type { MetadataRoute } from "next";
import { articles } from "@/data/articles";
import { countProducts, getBrands, getCategories, getMakes, getModels, listProductSlugs } from "@/lib/catalog";
import { site } from "@/lib/site";
import { PRODUCTS_PER_SITEMAP, sitemapCount } from "@/lib/sitemap";

type Entry = MetadataRoute.Sitemap[number];

const url = (path: string) => `${site.url}${path}`;

/**
 * Sitemap 0 holds the static pages and the whole taxonomy (categories, makes/models, brands, articles).
 * Sitemaps 1..N each hold a page of up to 20 000 product URLs — with ~80 000 products that is a handful of
 * files. Product slugs are read straight from MongoDB in a stable order, so 103 000 URLs never load at once.
 */
export async function generateSitemaps(): Promise<{ id: number }[]> {
  // id 0 → static + taxonomy; ids 1..N → product chunks (the index at /sitemap-index.xml lists them)
  return Array.from({ length: sitemapCount(await countProducts()) }, (_, id) => ({ id }));
}

export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const index = Number(await id);
  return index === 0 ? taxonomySitemap() : productSitemap(index - 1);
}

/** One page of product URLs (chunk is 0-based). */
async function productSitemap(chunk: number): Promise<MetadataRoute.Sitemap> {
  const slugs = await listProductSlugs(chunk * PRODUCTS_PER_SITEMAP, PRODUCTS_PER_SITEMAP);
  const entries: Entry[] = slugs.map((product) => ({
    url: url(`/product/${product.slug}`),
    lastModified: new Date(product.updatedAt),
    changeFrequency: "weekly",
    priority: 0.7,
  }));
  return entries;
}

/** Static pages + the full taxonomy (categories, makes/models, brands) + blog articles. */
async function taxonomySitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [categories, makes, brands] = await Promise.all([getCategories(), getMakes(), getBrands()]);

  const staticEntries: Entry[] = [
    { url: url("/"), lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: url("/catalog"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: url("/avto"), lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: url("/brands"), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: url("/aktsii"), lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: url("/blog"), lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: url("/karta-saitu"), lastModified: now, changeFrequency: "weekly", priority: 0.3 },
    { url: url("/oplata-i-dostavka"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: url("/povernennia"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: url("/harantiia"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: url("/pro-nas"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: url("/spivpratsia"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: url("/kontakty"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: url("/dohovir-oferty"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: url("/polityka-konfidentsiinosti"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const categoryEntries: Entry[] = categories.map((category) => ({
    url: url(`/catalog/${category.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: category.parentId ? 0.6 : 0.8,
  }));

  const vehicleGroups = await Promise.all(
    makes.map(async (make): Promise<Entry[]> => {
      const models = await getModels(make.id);
      const makeEntry: Entry = {
        url: url(`/avto/${make.slug}`),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      };
      const modelEntries: Entry[] = models.map((model) => ({
        url: url(`/avto/${make.slug}/${model.slug}`),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.5,
      }));
      return [makeEntry, ...modelEntries];
    }),
  );
  const vehicleEntries: Entry[] = vehicleGroups.flat();

  const brandEntries: Entry[] = brands.map((brand) => ({
    url: url(`/brands/${brand.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const articleEntries: Entry[] = articles.map((article) => ({
    url: url(`/blog/${article.slug}`),
    lastModified: new Date(article.date),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticEntries, ...categoryEntries, ...vehicleEntries, ...brandEntries, ...articleEntries];
}
