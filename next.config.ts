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
  images: {
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
