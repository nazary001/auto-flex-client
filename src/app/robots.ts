import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Allow crawling of all content; keep cart, checkout, account and search tools out of the index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/cart", "/checkout", "/account", "/favorites", "/search"],
    },
    sitemap: `${site.url}/sitemap.xml`,
    host: new URL(site.url).host,
  };
}
