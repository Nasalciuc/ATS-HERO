// What the CV font can draw. Inter (public/fonts, Regular and Bold) has no glyphs for emoji,
// dingbats such as ✔ ➤, or scripts such as Arabic, Hebrew, Devanagari, Chinese. react-pdf then
// falls back to the PDF's built-in Helvetica, which cannot draw them either and prints other
// letters in their place ("*'1ام%D'ïÛJ(/") or a tofu box. So text goes to the PDF templates
// through pdfData(): look-alikes where Inter has one, nothing where it has none.
// The DOCX keeps the text as typed: Word draws such characters with its own fallback fonts.
import type { CvData } from "@/lib/types";
import { printableCv } from "@/lib/cv-print";

/** Code points (hex ranges) Inter Regular AND Bold have glyphs for, without control characters
 *  and private-use slots. tests/cv-glyphs.test.tsx checks it against the font files and prints
 *  the new value if the fonts change. */
export const INTER_CHARS =
  "20-7e,a0-ac,ae-148,14a-1c3,1c5-254,256-27b,27e-284,286-290,292-2a4,2a6-304,306-30a,30c,30f,313," +
  "315,31b,323,326-328,32c,337-338,342-343,346-36f,374-376,37a-37f,384-38a,38c,38e-3a1,3a3-3d7," +
  "3dc-3dd,3f0-3f6,3f9-3fa,3fc-479,480-49d,4a0-4ff,52f,e3f,1d00,1d0d,1d1b,1d43,1d47-1d49,1d4d," +
  "1d4f-1d50,1d52,1d56-1d58,1d5b,1d62-1d65,1d9c,1da0,1dbb,1dbf-1df5,1dfc-1e9b,1e9d-1f15,1f18-1f1d," +
  "1f20-1f45,1f48-1f4d,1f50-1f57,1f59,1f5b,1f5d,1f5f-1f7d,1f80-1fb4,1fb6-1fc4,1fc6-1fd3,1fd6-1fdb," +
  "1fdd-1fef,1ff2-1ff4,1ff6-1ffe,2000-200b,2010-2027,202f-2055,2057,205f,2070-2071,2074-208e," +
  "2090-209c,20a0-20af,20b1-20b5,20b8-20ba,20bc-20bf,20db-20de,20e8,20f0,2100-2101,2103,2105-2106," +
  "2109,2113,2116-2117,211e-2122,2126,212a-212b,212e,2132,213b,214d,2150-217f,2183-2186,2189," +
  "2190-2199,21a9-21aa,21b0-21b1,21b3-21b5,21ba-21bb,21d0,21d2,21d4,21de-21df,21e4-21e5,21e7,21ea," +
  "2202,2205-2206,220f,2211-2212,221a,221e,222b,2236,2248,2260,2264-2265,2295-2298,2303-2305,2318," +
  "2325-2327,232b,2380,2387,238b,23ce-23cf,2423,2460-2468,24b6-24cf,24ea,25a0-25a2,25aa,25b2-25b3," +
  "25b6-25b7,25ba-25bd,25c0-25c1,25c4-25c7,25ca-25cb,25cf,25e6,25ef,2600,2605-2606,263c,2661,2665," +
  "26a0,2713,2717,2756,2764,2780-2788,27ef,27f5-27fa,2913,2a38,2b06,2b12-2b13,2b1c,2b24,2c7c,2c7f," +
  "2dff,2e18,a69f,a7ff,a92e,1f12f-1f149,1f16a-1f16b,1f850,1f852";

const RANGES: [number, number][] = INTER_CHARS.split(",").map((r) => {
  const [a, z] = r.split("-").map((h) => parseInt(h, 16));
  return [a, z ?? a];
});

export function hasGlyph(cp: number): boolean {
  let lo = 0;
  let hi = RANGES.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cp < RANGES[mid][0]) hi = mid - 1;
    else if (cp > RANGES[mid][1]) lo = mid + 1;
    else return true;
  }
  return false;
}

/** Symbols people paste that Inter lacks, and the Inter character that looks like each. */
const LOOK_ALIKE: Record<string, string> = {
  "✔": "✓", "✅": "✓", "☑": "✓", "✘": "✗", "❌": "✗", "❎": "✗",
  "➤": "›", "▸": "›", "❯": "›", "➔": "→", "➜": "→", "➝": "→", "➞": "→",
  "♦": "◆", "⭐": "★", "✩": "☆",
};

/** `text` with what Inter cannot draw replaced by a look-alike or left out (keeps line breaks;
 *  where something was left out, the spaces around it close up and a line left with no letter
 *  or digit — the "." of a sentence in another script — goes too). */
export function drawable(text: string): string {
  let out = "";
  let dropped = false;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (ch === "\n" || hasGlyph(cp)) out += ch;
    else if (LOOK_ALIKE[ch]) out += LOOK_ALIKE[ch];
    else if (ch === "\t") out += " ";
    else dropped = true;
  }
  if (!dropped) return out;
  return out
    .split("\n")
    .map((l) => l.replace(/ {2,}/g, " ").trim().replace(/^[.,;:!?·\-–—]+\s*/, ""))
    .filter((l) => /[\p{L}\p{N}]/u.test(l))
    .join("\n");
}

/** The characters of `text` that drawable() leaves out — for telling the user before export. */
export function undrawable(text: string): string[] {
  return [...new Set([...text].filter((ch) => ch !== "\n" && ch !== "\t" && !hasGlyph(ch.codePointAt(0)!) && !LOOK_ALIKE[ch]))];
}

/** Every string of a CV through drawable(), then entries left empty are dropped (printableCv);
 *  the PDF templates render this. */
export function pdfData(d: CvData): CvData {
  return printableCv(mapStrings(d) as CvData);
}

function mapStrings(v: unknown): unknown {
  if (typeof v === "string") return drawable(v);
  if (Array.isArray(v)) return v.map(mapStrings);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "photo" || k === "id" ? x : mapStrings(x)]));
  }
  return v;
}
