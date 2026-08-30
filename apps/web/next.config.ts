import type { NextConfig } from "next";
import path from "path";

const monorepoRoot = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Trace deps from monorepo root when Root Directory = apps/web on Vercel.
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
  },
  async headers() {
    // React's dev build needs eval() for debugging features. Production stays strict —
    // never widen this branch to cover prod.
    const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${devEval} https://*.clerk.accounts.dev https://challenges.cloudflare.com`,
      "connect-src 'self' https://*.clerk.accounts.dev https://clerk-telemetry.com " + (process.env.NEXT_PUBLIC_AI_URL ?? ""),
      "img-src 'self' data: blob: https:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "frame-src https://challenges.cloudflare.com",
      "worker-src 'self' blob:",
    ].join("; ");
    return [{ source: "/(.*)", headers: [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ]}];
  },
};

export default nextConfig;
