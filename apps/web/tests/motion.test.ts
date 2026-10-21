// Motion on the site follows three rules, and nothing else in the suite would notice if one broke:
// - one set of durations and one curve, as tokens in styles.css, so motion stays consistent;
// - with prefers-reduced-motion every animation and transition ends at once, on its final state;
// - keyframes move only what the GPU moves cheaply (transform, opacity, stroke-dashoffset), so an
//   animation never re-lays out the page.
// The design check depends on the second rule: it runs every spec with reduced motion, so it
// measures the Figma state, never a box halfway through a move.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const WEB = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(WEB, "app/styles.css"), "utf8");
const run = fs.readFileSync(path.join(WEB, "design-check/run.mjs"), "utf8");

/** The body of the first top-level block that starts at `start` (balanced braces). */
function blockAt(source: string, start: number): string {
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(open + 1, i);
  }
  throw new Error("unbalanced braces");
}

describe("motion tokens", () => {
  it("defines the durations and the curve once, in :root", () => {
    const root = blockAt(css, css.indexOf(":root"));
    for (const token of ["--motion-fast", "--motion-base", "--motion-slow", "--ease-out"]) {
      expect(root, `${token} missing from :root`).toMatch(new RegExp(`${token}\\s*:`));
    }
  });
});

describe("reduced motion", () => {
  it("ends every animation and transition at once", () => {
    const blocks = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\)/g)].map((m) => blockAt(css, m.index!));
    const global = blocks.find((b) => /\*,\s*\*::before,\s*\*::after/.test(b));
    expect(global, "the global reduced-motion block is gone from styles.css").toBeDefined();
    expect(global).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(global).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(global).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
    // A delay outlives a short duration: .appshell__side would stay in the Tab order 0.2s after closing.
    expect(global).toMatch(/animation-delay:\s*0ms\s*!important/);
    expect(global).toMatch(/transition-delay:\s*0ms\s*!important/);
  });

  it("is how the design check runs every spec", () => {
    expect(run).toMatch(/newPage\(\{[\s\S]*?reducedMotion: "reduce",[\s\S]*?\}\)/);
    expect(run).not.toMatch(/spec\.reducedMotion \?/);
  });
});

describe("keyframes", () => {
  const ALLOWED = new Set(["transform", "opacity", "stroke-dashoffset"]);

  it("animate only transform, opacity and stroke-dashoffset", () => {
    const frames = [...css.matchAll(/@keyframes\s+([\w-]+)/g)];
    expect(frames.length).toBeGreaterThan(0);
    for (const m of frames) {
      const body = blockAt(css, m.index!);
      const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((p) => p[1]);
      for (const prop of props) {
        expect(ALLOWED.has(prop), `@keyframes ${m[1]} animates "${prop}"`).toBe(true);
      }
    }
  });
});
