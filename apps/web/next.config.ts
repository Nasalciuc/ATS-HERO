import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    // Must match Vercel's outputFileTracingRoot for monorepo builds.
    root: path.resolve(__dirname, "../.."),
  },
};

export default nextConfig;
