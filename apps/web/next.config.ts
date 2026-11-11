import type { NextConfig } from "next";
import path from "path";
import { securityHeaders } from "./lib/csp";

const monorepoRoot = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Trace deps from monorepo root when Root Directory = apps/web on Vercel.
  outputFileTracingRoot: monorepoRoot,
  outputFileTracingIncludes: {
    "/*": ["./certs/**"],
    // "Ready to send" renders the CV on the server: the fonts are read from disk (fonts.ts)
    "/app/tracker/send": ["./public/fonts/Inter-*.ttf"],
  },
  turbopack: {
    root: monorepoRoot,
  },
  // The CSP and the other security headers live in lib/csp.ts (tests/consent.test.ts checks them).
  async headers() {
    return securityHeaders();
  },
};

export default nextConfig;
