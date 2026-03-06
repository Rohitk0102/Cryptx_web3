import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Empty turbopack config to silence webpack warning in Next.js 16
  turbopack: {},
  // Disable server-side rendering for faster client-side navigation
  experimental: {
    optimizeCss: true,
  },
};

export default nextConfig;
