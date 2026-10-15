// Regenerates app/favicon.ico (16, 32 and 48 px) and app/apple-icon.png (180 px) from app/icon.svg.
// Run it after changing app/icon.svg: `npm run icons`. Chromium draws the PNGs, so they are the
// pixels a browser tab shows.
//
// The mark is a CV page with the green score ring on its corner, the hero of the landing page
// in miniature. app/icon.svg is drawn on a 32-unit grid with even coordinates, so at 16 px most
// edges land on whole pixels.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const app = (name) => fileURLToPath(new URL(`../app/${name}`, import.meta.url));
const svg = readFileSync(app("icon.svg"), "utf8");

// The iPhone icon has no transparent corners (iOS rounds them and would fill the gap with black):
// the same drawing without its rounded tile, on a full square, with more room around it.
const tile = /<rect id="tile"[^>]*\/>/;
if (!tile.test(svg)) throw new Error('app/icon.svg needs its background as <rect id="tile" … />');
const inner = svg
  .replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "")
  .replace(/<title>[\s\S]*?<\/title>/, "")
  .replace(tile, "");
const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">
  <rect width="180" height="180" fill="#202020"/>
  <g transform="translate(23.5 19) scale(4.4)">${inner}</g>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function render(source, size) {
  const src = "data:image/svg+xml;base64," + Buffer.from(source).toString("base64");
  await page.setViewportSize({ width: size + 20, height: size + 20 });
  await page.setContent(`<body style="margin:0"><img id="i" src="${src}" width="${size}" height="${size}" style="display:block"></body>`);
  await page.waitForFunction(() => document.getElementById("i").complete);
  return page.locator("#i").screenshot({ omitBackground: true });
}

// ICO with PNG frames (every browser and Windows since Vista read them).
function ico(frames) {
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, png }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...frames.map((f) => f.png)]);
}

const frames = [];
for (const size of [16, 32, 48]) frames.push({ size, png: await render(svg, size) });
writeFileSync(app("favicon.ico"), ico(frames));
writeFileSync(app("apple-icon.png"), await render(appleSvg, 180));
await browser.close();
console.log("app/favicon.ico (16, 32, 48 px) and app/apple-icon.png (180 px) written from app/icon.svg");
