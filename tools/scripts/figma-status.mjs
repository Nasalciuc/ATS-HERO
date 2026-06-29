import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(ROOT, "reference", "figma", "manifest.json");

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const groups = ["desktop", "pages", "documentation", "mobile"];

for (const group of groups) {
  const items = manifest[group];
  let done = 0;
  let pending = 0;
  const missing = [];

  for (const item of items) {
    const dest = path.join(ROOT, "reference", "figma", group, item.file);
    if (fs.existsSync(dest)) {
      item.status = "done";
      done++;
    } else {
      item.status = "pending";
      pending++;
      missing.push(`  - ${item.name} (${item.id}) → ${item.file}`);
    }
  }

  console.log(`\n${group.toUpperCase()}: ${done}/${items.length} done, ${pending} pending`);
  if (missing.length) console.log(missing.join("\n"));
}

fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
console.log("\nManifest synced with files on disk.");
