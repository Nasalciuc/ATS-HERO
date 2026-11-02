import { defineConfig } from "vitest/config";
import path from "path";

// The apply lab (tests/apply-lab): the apply engine in a real browser on synthetic forms. Kept out of
// `npx vitest run` because it needs agent-browser and Chrome, which the web app doesn't depend on:
//   npm install --no-save agent-browser@0.41.1   (the version in lib/apply/runner.ts)
//   AGENT_BROWSER_EXECUTABLE_PATH=<a Chrome or Chromium>, if agent-browser doesn't find one
//   npm run apply-lab
// CI runs it in .github/workflows/apply-lab.yml.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    include: ["tests/apply-lab/**/*.lab.tsx"],
    environment: "node",
    // one browser at a time: each application is its own agent-browser session
    fileParallelism: false,
    testTimeout: 90_000,
    hookTimeout: 60_000,
  },
});
