// Reads the text of a rendered PDF with positions (pdf.js), for the CV output tests.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

/** One run of text: x and y of its start (y grows upwards, as in PDF), width and size in pt. */
export type PdfItem = { str: string; x: number; y: number; width: number; size: number };

/** The text items of every page; whitespace-only items are left out. */
export async function pdfItems(buf: Uint8Array): Promise<PdfItem[][]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, verbosity: 0 }).promise;
  const pages: PdfItem[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const { items } = await (await doc.getPage(p)).getTextContent();
    pages.push(
      items
        .filter((it): it is Extract<typeof it, { str: string }> => "str" in it && it.str.trim() !== "")
        .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width, size: Math.hypot(it.transform[0], it.transform[1]) })),
    );
  }
  return pages;
}

/** Items grouped into visual rows (same baseline ±2pt), top to bottom, each left to right. */
export function rowsOf(items: PdfItem[]): PdfItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: PdfItem[][] = [];
  for (const it of sorted) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last[0].y - it.y) < 2) last.push(it);
    else rows.push([it]);
  }
  return rows.map((r) => r.sort((a, b) => a.x - b.x));
}

/** A row's text, items joined by single spaces. */
export const rowText = (row: PdfItem[]) => row.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
