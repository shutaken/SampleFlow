import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.dmm.co.jp" },
      { protocol: "https", hostname: "*.dmm.com" },
      { protocol: "https", hostname: "pics.dmm.co.jp" }
    ]
  }
};

export default nextConfig;
