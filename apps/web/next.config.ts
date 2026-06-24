import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    // Pin the workspace root (the monorepo has multiple lockfiles).
    root: __dirname,
  },
};

export default nextConfig;
