/**
 * Download remaining Figma frames as PNG exports.
 *
 * Usage:
 *   set FIGMA_API_KEY=figd_...
 *   node scripts/download-figma-pages.mjs
 *
 * Options:
 *   --only pending   skip files that already exist (default)
 *   --force          re-download everything
 *   --delay 5000     ms between API calls (default 5000)
 *   --section NAME   only download one group: desktop, pages, documentation, mobile
 *   --priority       order: desktop → pages → documentation → mobile (default)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(ROOT, "reference", "figma", "manifest.json");
const FILE_KEY = "VnCd2MBmt4sYlVmtOVyCMH";

const args = process.argv.slice(2);
const force = args.includes("--force");
const delayMs = Number(args[args.indexOf("--delay") + 1] || 5000);
const sectionArg = args.includes("--section")
  ? args[args.indexOf("--section") + 1]
  : null;

const GROUPS = ["desktop", "pages", "documentation", "mobile"];

const token = process.env.FIGMA_API_KEY;
if (!token) {
  console.error("Set FIGMA_API_KEY environment variable.");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));

const selectedGroups = sectionArg
  ? [sectionArg]
  : GROUPS;

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

async function exportNode(nodeId, destPath) {
  const url = new URL(`https://api.figma.com/v1/images/${FILE_KEY}`);
  url.searchParams.set("ids", nodeId);
  url.searchParams.set("format", "png");
  url.searchParams.set("scale", "1");

  const res = await fetch(url, {
    headers: { "X-Figma-Token": token },
  });

  if (!res.ok) {
    const body = await res.text();
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
      console.error("\nRate limit hit — stop and retry later with a longer --delay.");
      break;
    }
  }

  await sleep(delayMs);
}

// Persist updated status
for (const group of ["pages", "desktop", "documentation", "mobile"]) {
  for (const item of manifest[group]) {
    const dest = path.join(ROOT, "reference", "figma", group === "pages" ? "pages" : group, item.file);
    if (fs.existsSync(dest)) item.status = "done";
  }
}
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

console.log(`\nDone: ${ok} downloaded, ${skipped} skipped, ${failed} failed.`);
