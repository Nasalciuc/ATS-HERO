import * as pdfjsLib from "pdfjs-dist";
import { loadWorker, MAX_PDF_PAGES } from "../pdf";
import { ATS_SIZE_LIMIT_BYTES, NO_SIGNALS, type AtsRead, type HiddenLink } from "./types";

/** The parts of a pdf.js text item this module reads. */
interface Item {
  str: string;
  hasEOL: boolean;
  /** [a, b, c, d, x, y]: x and y are the start of the text's baseline, in PDF points from the bottom left */
  transform: number[];
  width: number;
  fontName: string;
}

interface PageText {
  width: number;
  /** normalized text (ligatures expanded), as every reading uses */
  items: Item[];
  /** the same items before pdf.js expands ligatures */
  rawItems: Item[];
  links: { url: string; rect: number[] }[];
}

const isItem = (i: object): i is Item => "str" in i;
const LIGATURES = /[ﬀ-ﬆ]/;

/**
 * Reads a PDF the ways ATS text extractors do, plus the layout signals behind their differences.
 * Throws when the file is not a readable PDF, like `extractPdfText`. A PDF over MAX_PDF_PAGES pages
 * is reported with no readings.
 */
export async function readPdf(data: ArrayBuffer): Promise<AtsRead> {
  await loadWorker();
  const bytes = data.byteLength;
  const task = pdfjsLib.getDocument({ data: new Uint8Array(data), isEvalSupported: false });
  try {
    const pdf = await task.promise;
    const info = ((await pdf.getMetadata()).info ?? {}) as { Producer?: string; Creator?: string };
    const producer = (info.Producer || info.Creator || "").trim() || null;
    const base: AtsRead = {
      kind: "pdf",
      bytes,
      pages: pdf.numPages,
      producer,
      readings: [],
      signals: { ...NO_SIGNALS, overSizeLimit: bytes > ATS_SIZE_LIMIT_BYTES },
    };
    if (pdf.numPages > MAX_PDF_PAGES) return base;

    const pages: PageText[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const items = (await page.getTextContent()).items.filter(isItem) as Item[];
      const rawItems = (await page.getTextContent({ disableNormalization: true })).items.filter(isItem) as Item[];
      const links = ((await page.getAnnotations()) as { url?: string; rect?: number[] }[])
        .filter((a) => typeof a.url === "string" && Array.isArray(a.rect))
        .map((a) => ({ url: a.url as string, rect: a.rect as number[] }));
      pages.push({ width: page.getViewport({ scale: 1 }).width, items, rawItems, links });
    }

    const stream = cleanLines(pages.map((p) => streamText(p.items)).join("\n"));
    const rows = cleanLines(pages.map((p) => rowsText(p.items)).join("\n"));
    const fonts = new Set(pages.flatMap((p) => p.items.filter((i) => i.str.trim()).map((i) => i.fontName)));

    return {
      ...base,
      readings: [
        { reader: "pdf-stream", text: stream },
        { reader: "pdf-rows", text: rows },
      ],
      signals: {
        ...base.signals,
        twoColumns: pages.some((p) => hasColumnGutter(p.items, p.width)),
        hiddenLinks: hiddenLinks(pages, stream),
        ligatureWords: ligatureWords(pages),
        fonts: fonts.size,
      },
    };
  } finally {
    await task.destroy();
  }
}

/** The order the PDF stores its text, one line per printed line: the same text as `extractPdfText`. */
export function streamText(items: Item[]): string {
  let out = "";
  for (const it of items) out += it.str + (it.hasEOL ? "\n" : "");
  return out;
}

/**
 * The page read top to bottom, one printed row at a time, left to right: items whose baselines are
 * within 2 points form a row. Pieces of one word in different fonts (no gap) are glued; a visible
 * gap becomes a space. The same rules as the lab's `lab/pdfjs-extract.mjs`.
 */
export function rowsText(items: Item[]): string {
  const rows: { y: number; parts: { x: number; end: number; size: number; s: string }[] }[] = [];
  for (const it of items) {
    if (!it.str) continue;
    const y = Math.round(it.transform[5]);
    const x = it.transform[4];
    const size = Math.hypot(it.transform[2], it.transform[3]) || 10;
    let row = rows.find((r) => Math.abs(r.y - y) <= 2);
    if (!row) rows.push((row = { y, parts: [] }));
    row.parts.push({ x, end: x + it.width, size, s: it.str });
  }
  rows.sort((a, b) => b.y - a.y);
  const out: string[] = [];
  for (const r of rows) {
    r.parts.sort((a, b) => a.x - b.x);
    let text = "";
    let end: number | null = null;
    for (const part of r.parts) {
      const gap = end === null ? 0 : part.x - end;
      if (end !== null && gap > 0.15 * part.size && !/\s$/.test(text) && !/^\s/.test(part.s)) text += " ";
      text += part.s;
      end = Math.max(end ?? part.end, part.end);
    }
    out.push(text);
  }
  return out.join("\n");
}

function cleanLines(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Two columns side by side: the widest vertical band between 20% and 80% of the page width that no
 * text crosses, with at least 8 text rows left of it and at least 8 right of it. Measured on the
 * ATS lab's 30 template PDFs and 5 Word-made PDFs: right on all 35 (ATS-VIEW-DESIGN.md §1.6).
 * Without the 8-row condition, short one-column lines leave the middle empty and look like a gutter.
 */
export function hasColumnGutter(items: Item[], pageWidth: number): boolean {
  const BINS = 100;
  const covered = new Array<number>(BINS).fill(0);
  const text = items.filter((i) => i.str.trim());
  for (const it of text) {
    const x0 = it.transform[4];
    const x1 = x0 + it.width;
    const first = Math.max(0, Math.floor((x0 / pageWidth) * BINS));
    const last = Math.min(BINS - 1, Math.floor((x1 / pageWidth) * BINS));
    for (let b = first; b <= last; b++) covered[b]++;
  }
  let best = 0;
  let bestEnd = -1;
  let run = 0;
  for (let b = 20; b < 80; b++) {
    run = covered[b] === 0 ? run + 1 : 0;
    if (run > best) {
      best = run;
      bestEnd = b;
    }
  }
  if (best < 2) return false;
  const gutterLeft = ((bestEnd - best + 1) / BINS) * pageWidth;
  const gutterRight = ((bestEnd + 1) / BINS) * pageWidth;
  const leftRows = new Set<number>();
  const rightRows = new Set<number>();
  for (const it of text) {
    const row = Math.round(it.transform[5] / 4);
    if (it.transform[4] + it.width <= gutterLeft) leftRows.add(row);
    else if (it.transform[4] >= gutterRight) rightRows.add(row);
  }
  return leftRows.size >= 8 && rightRows.size >= 8;
}

/** A URL reduced to what a person would print: no scheme, no "www.", no trailing slash, lower case. */
export function printedForm(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

/** Web links (http/https) whose address doesn't appear in the page text; mailto: and tel: are skipped. */
function hiddenLinks(pages: PageText[], text: string): HiddenLink[] {
  const printed = text.toLowerCase().replace(/\s+/g, "");
  const found: HiddenLink[] = [];
  for (const p of pages) {
    for (const link of p.links) {
      if (!/^https?:\/\//i.test(link.url)) continue;
      const form = printedForm(link.url);
      if (!form || printed.includes(form.replace(/\s+/g, ""))) continue;
      if (found.some((f) => printedForm(f.url) === form)) continue;
      found.push({ url: link.url, label: textUnder(p.items, link.rect) });
    }
  }
  return found;
}

/** The text of the items whose baseline start lies inside a link's rectangle [x1, y1, x2, y2]. */
function textUnder(items: Item[], rect: number[]): string {
  const [x1, y1, x2, y2] = rect;
  const pad = 2;
  return items
    .filter((it) => {
      const [x, y] = [it.transform[4], it.transform[5]];
      return x >= Math.min(x1, x2) - pad && x <= Math.max(x1, x2) + pad && y >= Math.min(y1, y2) - pad && y <= Math.max(y1, y2) + pad;
    })
    .map((it) => it.str)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The distinct words drawn with a ligature glyph, as a reader that keeps the glyph sees them
 * ("Airﬂow"). pdf.js often gives the glyph as an item of its own, so words are cut from the raw
 * text in stream order, not from single items.
 */
function ligatureWords(pages: PageText[]): string[] {
  return [...new Set(pages.flatMap((p) => ligatureWordsIn(p.rawItems)))];
}

export function ligatureWordsIn(rawItems: Pick<Item, "str" | "hasEOL">[]): string[] {
  const words = new Set<string>();
  for (const w of streamText(rawItems as Item[]).split(/[\s,.;:()|•·/]+/))
    if (LIGATURES.test(w)) words.add(w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""));
  return [...words].filter(Boolean);
}
