import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The MongoDB driver is externalised by Next.js itself; the dev-only in-memory server spawns a
  // mongod process and must never be bundled.
  serverExternalPackages: ["mongodb-memory-server"],
  // The local MongoDB data directory is referenced from server code; keep its (locked) files out of the build trace
  outputFileTracingExcludes: { "*": ["./data/**", "./node_modules/.cache/**"] },
  experimental: {
    // Price-list / price CSV imports in the admin are uploaded through Server Actions
    serverActions: { bodySizeLimit: "8mb" },
  },
  async rewrites() {
    // The conventional sitemap address: app/sitemap.ts (generateSitemaps) only serves /sitemap/<id>.xml,
    // the index lives in app/sitemap-index.xml/route.ts
    return [{ source: "/sitemap.xml", destination: "/sitemap-index.xml" }];
  },
  images: {
    // Vercel's image optimizer counts every distinct source image against a monthly quota; with
    // ~90 000 supplier photos crawled by bots the Hobby quota is gone in days and every photo then
    // fails with 402 (OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED). Serve images as they are instead:
    // the supplier CDN already delivers web-sized JPEGs and allows hot-linking.
    unoptimized: true,
    // Product photos are served from the supplier (DD Tuning / DD Audio) hosts
    remotePatterns: [
      { protocol: "https", hostname: "ddaudio.com.ua" },
      { protocol: "https", hostname: "media.ddaudio.com.ua" },
      { protocol: "https", hostname: "ddtuning.com.ua" },
      { protocol: "https", hostname: "media.ddtuning.com.ua" },
    ],
  },
};

export default nextConfig;
