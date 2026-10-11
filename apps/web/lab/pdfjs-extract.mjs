// ATS lab — pdf.js extractor. Prints the text a browser-side parser sees: pdf.js text items
// grouped into lines by baseline (y), joined left→right. Usage: node lab/pdfjs-extract.mjs file.pdf
import fs from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const data = new Uint8Array(fs.readFileSync(process.argv[2]));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true, verbosity: 0 }).promise;
const out = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const { items } = await page.getTextContent();
  // Group by rounded baseline in content-stream order (what OpenResume-style parsers do first).
  const lines = [];
  for (const it of items) {
    if (!("str" in it)) continue;
    const y = Math.round(it.transform[5]);
    const x = it.transform[4];
    const size = Math.hypot(it.transform[2], it.transform[3]) || 10;
    let line = lines.find((l) => Math.abs(l.y - y) <= 2);
    if (!line) lines.push((line = { y, parts: [] }));
    line.parts.push({ x, end: x + it.width, size, s: it.str });
  }
  lines.sort((a, b) => b.y - a.y);
  for (const l of lines) {
    l.parts.sort((a, b) => a.x - b.x);
    // pdf.js already emits real spaces as " " items. A font switch inside a word (a synthesized
    // small cap, or 'Chi'+'ș'+'in' when the webfont lacks ș and it falls back to another font) is a
    // new item with no gap: glue it, as OpenResume does (merge items closer than a character);
    // a visible gap stays a space.
    let text = "";
    let end = null;
    for (const part of l.parts) {
      const gap = end === null ? 0 : part.x - end;
      if (end !== null && gap > 0.15 * part.size && !/\s$/.test(text) && !/^\s/.test(part.s)) text += " ";
      text += part.s;
      end = Math.max(end ?? part.end, part.end);
    }
    out.push(text.replace(/\s+/g, " ").trim());
  }
}
process.stdout.write(out.filter(Boolean).join("\n"));
