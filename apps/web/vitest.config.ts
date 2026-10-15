import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "node",
    // tests/db start an in-memory Postgres (PGlite) in beforeEach: ~2 s on a 2-core Linux runner,
    // over vitest's default 10 s on a Windows laptop while the PDF tests run in parallel.
    hookTimeout: 30_000,
  },
});
