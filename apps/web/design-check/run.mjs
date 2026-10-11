#!/usr/bin/env node
// Figma spec-check — "pixel-perfect" as a number, not an opinion.
//
// For every spec in design-check/specs/*.json: open the route at the Figma frame size, measure each
// element tagged data-figma="<key>", and compare its box (x, y, w, h) and computed styles with the
// Figma frame (geometry snapshot in design-check/figma/*.json, or explicit boxes for nodes inside
// Figma instances). Also writes a screenshot, a pixel diff and a 50/50 overlay against the Figma
// export so a human can see what the numbers mean.
//
//   npm run design:check                 # all specs; BASE_URL defaults to http://localhost:3000
//   npm run design:check -- builder-step1
//
// Exit code 1 when a spec marked "locked" has a failing or missing check (the CI gate).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const ROOT = path.dirname(fileURLToPath(import.meta.url)); // apps/web/design-check
const REPO = path.resolve(ROOT, "../../..");
const OUT = path.join(ROOT, "out");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const snapshots = Object.fromEntries(
  fs
    .readdirSync(path.join(ROOT, "figma"))
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, "figma", f), "utf8")).frames)),
);
const only = process.argv.slice(2);
const specs = fs
  .readdirSync(path.join(ROOT, "specs"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, "specs", f), "utf8")))
  .filter((s) => only.length === 0 || only.includes(s.id));

const num = (v) => (typeof v === "string" && /^-?\d+(\.\d+)?px$/.test(v) ? parseFloat(v) : null);

function sameStyle(want, got) {
  if (want === got) return true;
  const a = num(want);
  const b = num(got);
  return a !== null && b !== null && Math.abs(a - b) <= 0.05;
}

// Setup steps put the screen into the state the Figma frame shows:
//   { "click": sel } { "fill": [sel, text] } { "press": [sel, key] } { "select": [sel, value] } { "wait": ms }
async function runSetup(page, steps = []) {
  for (const s of steps) {
    if (s.click) await page.locator(s.click).first().click();
    if (s.fill) await page.locator(s.fill[0]).first().fill(s.fill[1]);
    if (s.press) await page.locator(s.press[0]).first().press(s.press[1]);
    if (s.select) await page.locator(s.select[0]).first().selectOption(s.select[1]);
    if (s.wait) await page.waitForTimeout(s.wait);
  }
  // Figma frames show no hover or focus state.
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.mouse.move(page.viewportSize().width - 2, page.viewportSize().height - 2);
}

function blend(a, b, w, h) {
  const out = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h * 4; i += 4) {
    for (let c = 0; c < 3; c++) out.data[i + c] = (a.data[i + c] + b.data[i + c]) >> 1;
    out.data[i + 3] = 255;
  }
  return out;
}

const results = [];
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

for (const spec of specs) {
  const frame = snapshots[spec.frame];
  if (!frame) throw new Error(`${spec.id}: frame ${spec.frame} is not in design-check/figma/*.json`);
  const page = await browser.newPage({ viewport: spec.viewport, deviceScaleFactor: 1 });
  await page.goto(BASE + spec.route, { waitUntil: "networkidle" });
  // The Next.js dev-tools badge is not part of the product.
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await runSetup(page, spec.setup);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  const measured = await page.evaluate((checks) => {
    const out = {};
    for (const c of checks) {
      const el = document.querySelector(`[data-figma="${c.key}"]`);
      if (!el) {
        out[c.key] = null;
        continue;
      }
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const style = {};
      for (const prop of Object.keys(c.style ?? {})) style[prop] = cs.getPropertyValue(prop).trim();
      out[c.key] = { box: [r.x + scrollX, r.y + scrollY, r.width, r.height], style };
    }
    return out;
  }, spec.checks);

  const rows = spec.checks.map((c) => {
    const want = c.box ?? frame.nodes[c.node]?.box;
    if (!want) throw new Error(`${spec.id}/${c.key}: node ${c.node} not found in frame ${spec.frame}`);
    const got = measured[c.key];
    if (!got) return { key: c.key, want, got: null, ok: false, problems: ["element with this data-figma key not found"] };
    const tol = c.tolerance ?? spec.tolerance ?? 2;
    const problems = [];
    ["x", "y", "w", "h"].forEach((dim, i) => {
      if (want[i] === null || want[i] === undefined) return;
      const d = got.box[i] - want[i];
      if (Math.abs(d) > tol) problems.push(`${dim} ${got.box[i].toFixed(1)} vs ${want[i]} (${d > 0 ? "+" : ""}${d.toFixed(1)})`);
    });
    for (const [prop, w] of Object.entries(c.style ?? {})) {
      if (!sameStyle(w, got.style[prop])) problems.push(`${prop} ${got.style[prop]} vs ${w}`);
    }
    return { key: c.key, want, got: got.box.map((v) => Math.round(v * 10) / 10), ok: problems.length === 0, problems };
  });

  // Screenshot + diff against the Figma export (visual aid; the numbers above are the gate).
  const shotPath = path.join(OUT, `${spec.id}.png`);
  await page.screenshot({ path: shotPath });
  let pixelDiff = null;
  const refPath = spec.reference && path.join(REPO, spec.reference);
  if (refPath && fs.existsSync(refPath)) {
    const ref = PNG.sync.read(fs.readFileSync(refPath));
    const shot = PNG.sync.read(fs.readFileSync(shotPath));
    if (ref.width === shot.width && ref.height === shot.height) {
      const diff = new PNG({ width: ref.width, height: ref.height });
      const n = pixelmatch(ref.data, shot.data, diff.data, ref.width, ref.height, { threshold: 0.1 });
      pixelDiff = Math.round((1000 * n) / (ref.width * ref.height)) / 10;
      fs.writeFileSync(path.join(OUT, `${spec.id}-diff.png`), PNG.sync.write(diff));
      fs.writeFileSync(path.join(OUT, `${spec.id}-overlay.png`), PNG.sync.write(blend(ref, shot, ref.width, ref.height)));
    }
  }
  await page.close();
  const passed = rows.filter((r) => r.ok).length;
  results.push({ id: spec.id, title: spec.title, frame: spec.frame, locked: !!spec.locked, passed, total: rows.length, pixelDiff, rows });
  console.log(`${spec.locked ? "🔒" : "  "} ${spec.id.padEnd(22)} ${String(passed).padStart(3)}/${rows.length} checks within ±${spec.tolerance ?? 2}px` + (pixelDiff !== null ? ` · ${pixelDiff}% pixels differ from the Figma export` : ""));
}
await browser.close();

const md = ["# Figma spec-check", "", `Base URL: ${BASE}`, ""];
for (const r of results) {
  md.push(`## ${r.title} (${r.id}, Figma ${r.frame}) — ${r.passed}/${r.total}${r.locked ? " 🔒" : ""}`, "");
  if (r.pixelDiff !== null) md.push(`Pixels that differ from the Figma export: **${r.pixelDiff}%** (see \`${r.id}-diff.png\`, \`${r.id}-overlay.png\`).`, "");
  md.push("| key | Figma [x, y, w, h] | ours | |", "|---|---|---|---|");
  for (const row of r.rows) {
    md.push(`| ${row.key} | ${JSON.stringify(row.want)} | ${row.got ? JSON.stringify(row.got) : "—"} | ${row.ok ? "✅" : "❌ " + row.problems.join("; ")} |`);
  }
  md.push("");
}
fs.writeFileSync(path.join(OUT, "REPORT.md"), md.join("\n"));
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
const gate = results.filter((r) => r.locked && r.passed < r.total);
if (gate.length) {
  console.error(`\nFAIL: ${gate.map((r) => `${r.id} (${r.total - r.passed} off-spec)`).join(", ")} — see design-check/out/REPORT.md`);
  process.exit(1);
}
