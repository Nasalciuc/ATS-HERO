/**
 * Download remaining Figma frames as PNG exports.
 *
 * Usage:
 *   # Token from .env (FIGMA_API_KEY) or .cursor/mcp.json
 *   node scripts/download-figma-pages.mjs
 *
 * Options:
 *   --force          re-download everything
 *   --delay 8000     ms between API calls (default 8000)
 *   --section NAME   desktop | pages | documentation | mobile
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(ROOT, "reference", "figma", "manifest.json");

const args = process.argv.slice(2);
const force = args.includes("--force");
const delayMs = Number(args[args.indexOf("--delay") + 1] || 8000);
const sectionArg = args.includes("--section")
  ? args[args.indexOf("--section") + 1]
  : null;

const GROUPS = ["desktop", "pages", "documentation", "mobile"];

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

function loadFigmaToken() {
  loadDotEnv(path.join(ROOT, ".env"));
  if (process.env.FIGMA_API_KEY) return process.env.FIGMA_API_KEY;

  const mcpPath = path.join(ROOT, ".cursor", "mcp.json");
  if (fs.existsSync(mcpPath)) {
    try {
      const mcp = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
      for (const srv of Object.values(mcp.mcpServers ?? {})) {
        const key = srv?.env?.FIGMA_API_KEY;
        if (key && !key.includes("your_figma")) return key;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

const token = loadFigmaToken();
if (!token) {
  console.error("Missing FIGMA_API_KEY. Add it to .env or .cursor/mcp.json → env.FIGMA_API_KEY");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const FILE_KEY = manifest.fileKey ?? "PNKgBLPtOt19nrqTHHywho";

const selectedGroups = sectionArg ? [sectionArg] : GROUPS;

if (sectionArg && !GROUPS.includes(sectionArg)) {
  console.error(`Unknown section "${sectionArg}". Use: ${GROUPS.join(", ")}`);
  process.exit(1);
}

const jobs = selectedGroups.flatMap((group) =>
  manifest[group].map((x) => ({ ...x, outDir: group }))
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatRetryAfter(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s)) return seconds;
  const h = Math.floor(s / 3600);
  const d = Math.floor(h / 24);
  if (d > 0) return `~${d} day(s) (${s}s)`;
  if (h > 0) return `~${h} hour(s) (${s}s)`;
  return `${s}s`;
}

async function exportNode(nodeId, destPath) {
  const url = new URL(`https://api.figma.com/v1/images/${FILE_KEY}`);
  url.searchParams.set("ids", nodeId);
  url.searchParams.set("format", "png");
  url.searchParams.set("scale", "1");

  const res = await fetch(url, {
    headers: { "X-Figma-Token": token },
  });

  if (!res.ok) {
    const retryAfter = res.headers.get("retry-after");
    const body = await res.text();
    if (res.status === 429 && retryAfter) {
      throw new Error(
        `429 Rate limit — retry after ${formatRetryAfter(retryAfter)} (plan: ${res.headers.get("x-figma-plan-tier") ?? "?"})`
      );
    }
    throw new Error(`${res.status} ${body}`);
  }

  const json = await res.json();
  const imageUrl = json.images?.[nodeId];
  if (!imageUrl) throw new Error(`No image URL for node ${nodeId}`);

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const buf = Buffer.from(await imgRes.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

let ok = 0;
let skipped = 0;
let failed = 0;

console.log(`Figma export — ${jobs.length} job(s), delay ${delayMs}ms\n`);

for (const job of jobs) {
  const dest = path.join(ROOT, "reference", "figma", job.outDir, job.file);

  if (!force && fs.existsSync(dest)) {
    console.log(`skip  ${job.file}`);
    skipped++;
    continue;
  }

  process.stdout.write(`fetch ${job.name} (${job.id})… `);
  try {
    await exportNode(job.id, dest);
    job.status = "done";
    console.log("ok");
    ok++;
  } catch (err) {
    console.log("FAIL");
    console.error(`  ${err.message}`);
    failed++;
    if (String(err.message).includes("429")) {
      console.error("\nRate limit — wait for reset or export manually from Figma UI.");
      console.error("Upgrade: https://www.figma.com/files?api_paywall=true");
      break;
    }
  }

  await sleep(delayMs);
}

for (const group of GROUPS) {
  for (const item of manifest[group]) {
    const dest = path.join(ROOT, "reference", "figma", group, item.file);
    if (fs.existsSync(dest)) item.status = "done";
  }
}
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

console.log(`\nDone: ${ok} downloaded, ${skipped} skipped, ${failed} failed.`);
