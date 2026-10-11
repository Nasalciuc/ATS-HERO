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
    let line = lines.find((l) => Math.abs(l.y - y) <= 2);
    if (!line) lines.push((line = { y, parts: [] }));
    line.parts.push({ x, s: it.str });
  }
  lines.sort((a, b) => b.y - a.y);
  for (const l of lines) {
    l.parts.sort((a, b) => a.x - b.x);
    out.push(l.parts.map((p) => p.s).join(" ").replace(/\s+/g, " ").trim());
  }
}
process.stdout.write(out.filter(Boolean).join("\n"));
