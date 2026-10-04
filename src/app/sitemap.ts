import type { MetadataRoute } from "next";
import { articles } from "@/data/articles";
import { getBrands, getCategories, getMakes, getModels, getProducts } from "@/lib/catalog";
import { site } from "@/lib/site";

type Entry = MetadataRoute.Sitemap[number];

/** Every indexable URL: static pages, categories, makes, models, brands, products and articles. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const url = (path: string) => `${site.url}${path}`;

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

  const categoryEntries: Entry[] = getCategories().map((category) => ({
    url: url(`/catalog/${category.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: category.parentId ? 0.6 : 0.8,
  }));

  const vehicleEntries: Entry[] = getMakes().flatMap((make) => [
    { url: url(`/avto/${make.slug}`), lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    ...getModels(make.id).map(
      (model): Entry => ({
        url: url(`/avto/${make.slug}/${model.slug}`),
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.5,
      }),
    ),
  ]);

  const brandEntries: Entry[] = getBrands().map((brand) => ({
    url: url(`/brands/${brand.slug}`),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const productEntries: Entry[] = getProducts().map((product) => ({
    url: url(`/product/${product.slug}`),
    lastModified: new Date(product.createdAt),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const articleEntries: Entry[] = articles.map((article) => ({
    url: url(`/blog/${article.slug}`),
    lastModified: new Date(article.date),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [
    ...staticEntries,
    ...categoryEntries,
    ...vehicleEntries,
    ...brandEntries,
    ...productEntries,
    ...articleEntries,
  ];
}
