import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // When the supplier feed is connected, allow its photo host here, e.g.:
    // remotePatterns: [{ protocol: "https", hostname: "cdn.supplier.example", pathname: "/products/**" }],
  },
};

export default nextConfig;
