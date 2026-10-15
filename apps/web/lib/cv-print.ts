// What actually goes on paper. ONE boundary for every output (live preview, PDF, DOCX), so no
// template can print an entry the user added but never filled — e.g. clicking "Add work
// experience" and moving on used to print a lone "EXPERIENCE" heading followed by "—".
import type { CvData, SimpleEntry } from "./types";

const filled = (...values: (string | undefined)[]): boolean =>
  values.some((v) => (v ?? "").trim() !== "");

const simpleFilled = (s: SimpleEntry): boolean =>
  filled(s.title, s.description, s.organisation, s.issuer, s.publisher, s.role, s.link);

/** CvData with blank entries removed. Pure — never mutates the editing buffer. */
export function printableCv(d: CvData): CvData {
  return {
    ...d,
    work: d.work.filter((w) => filled(w.role, w.company, w.description)),
    education: d.education.filter((e) => filled(e.institution, e.degree, e.minor, e.additional)),
    languages: d.languages.filter((l) => filled(l.name)),
    awards: d.awards.filter(simpleFilled),
    certifications: d.certifications.filter(simpleFilled),
    publications: d.publications.filter(simpleFilled),
    volunteering: d.volunteering.filter(simpleFilled),
    activities: d.activities.filter(simpleFilled),
  };
}

// Bullet markers people paste in front of a line (Word's Symbol / Wingdings bullets arrive as
// private-use characters U+F0A7, U+F0B7, U+F0D8, U+F0FC, U+F076, U+F06E). The templates and the
// DOCX draw their own bullet, so the pasted one would show twice.
const PASTED_MARKER = /^(?:[•·\-*▪■□●◦○‣⁃➤►▶▸→⇒➔➜➝➞✓✔✗✘★☆♦◆❖❯›»\uF0A7\uF0B7\uF0D8\uF0FC\uF076\uF06E]\s*)+/;

/** A description's lines, one bullet each: trimmed, pasted markers removed, blank lines dropped. */
export function descLines(text?: string): string[] {
  return (text || "").split(/\r?\n/).map((s) => s.trim().replace(PASTED_MARKER, "").trim()).filter(Boolean);
}

/** A phone number as a link: digits and "+" only, without an extension ("ext. 12", "x12") and
 *  without the "(0)" that is not dialled after a country code ("+44 (0) 20 …"). */
export function telHref(phone: string): string {
  let p = phone.replace(/\s*(?:ext\.?|extension|x|#)\s*\d+\s*$/i, "");
  if (p.trim().startsWith("+")) p = p.replace(/\(0\)/g, "");
  return `tel:${p.replace(/[^\d+]/g, "")}`;
}

/** A link a reader can click: an address typed without "https://" gets it. */
export function webHref(url: string): string {
  const u = url.trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u}`;
}

/** "BSc Computer Science, Minor in Mathematics" — the minor used to be collected, never printed. */
export function degreeLine(e: { degree: string; minor: string }): string {
  return [e.degree, e.minor ? `Minor in ${e.minor}` : ""].filter(Boolean).join(", ");
}

/** Paper form of a URL — no scheme, no "www.", no trailing slash ("linkedin.com/in/ana").
 *  Shorter on the page and still recognised by ATS parsers. A LinkedIn link also loses its
 *  "?utm_…" / "#…" tail (share links carry one; the profile is the path). Non-URLs pass
 *  through trimmed. */
export function displayUrl(url: string): string {
  const u = url.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const path = /^([a-z]{2,3}\.)?linkedin\.com\//i.test(u) ? u.replace(/[?#].*$/, "") : u;
  return path.replace(/\/+$/, "");
}

// Inter advance widths in 1/1000 em for ASCII 32–126, measured with fontkit from
// public/fonts/Inter-Regular.ttf and Inter-Bold.ttf (unitsPerEm 2048). Other characters use a
// wide average, so a measured width errs on the long side.
const INTER_ADVANCE = [
  281, 288, 466, 633, 642, 982, 644, 300, 365, 365, 501, 662, 288, 460, 288, 360, 631, 407, 610, 618, 646, 593, 620, 566,
  619, 620, 288, 302, 662, 662, 662, 511, 966, 690, 654, 730, 722, 601, 590, 746, 743, 269, 571, 672, 565, 903, 753, 765,
  639, 765, 644, 642, 646, 744, 690, 985, 682, 679, 629, 365, 360, 365, 471, 456, 323, 562, 612, 571, 612, 583, 370, 613,
  591, 242, 242, 549, 242, 876, 591, 600, 612, 612, 376, 528, 327, 591, 562, 818, 546, 562, 552, 426, 333, 426, 662,
];
const INTER_BOLD_ADVANCE = [
  237, 338, 552, 649, 655, 1016, 672, 339, 377, 377, 559, 679, 334, 468, 334, 388, 674, 431, 630, 646, 676, 622, 649, 582,
  651, 649, 334, 343, 679, 679, 679, 560, 1016, 747, 662, 740, 722, 607, 587, 750, 747, 281, 584, 719, 565, 932, 762, 771,
  648, 777, 657, 655, 667, 732, 747, 1038, 738, 731, 664, 377, 388, 377, 487, 476, 365, 581, 630, 588, 630, 596, 398, 632,
  623, 271, 271, 580, 271, 913, 623, 613, 630, 630, 407, 560, 366, 623, 600, 850, 580, 602, 573, 469, 372, 469, 679,
];
const NON_ASCII_ADVANCE = 640;

/** Invisible break mark. fonts.ts's hyphenation callback turns it into a place where react-pdf
 *  may wrap a word WITHOUT adding a hyphen, and drops it, so it never reaches the PDF's text. */
export const BREAK = "\u200B";

/** Rendered width in points of `text` set in Inter (Regular or Bold) at `fontSize`. */
export function textWidth(text: string, fontSize: number, bold = false): number {
  const table = bold ? INTER_BOLD_ADVANCE : INTER_ADVANCE;
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === BREAK) continue;
    units += code >= 32 && code < 127 ? table[code - 32] : ch === "\u00A0" ? table[0] : NON_ASCII_ADVANCE;
  }
  return (units * fontSize) / 1000;
}

/**
 * Font size at which `text` fits `maxWidth` on ONE line (never above `base`, never below
 * `min`, rounded down to 0.25pt). Contact tokens must never wrap: the ATS lab showed a wrapped
 * e-mail/URL is lost by every extractor (and pdf.js joins split pieces with spaces). Text that
 * does not fit even at `min` wraps (ContactBar) rather than run off the page.
 */
export function fitFontSize(text: string, maxWidth: number, base = 9, min = 6.5, bold = false): number {
  const width = textWidth(text, base, bold);
  if (width <= maxWidth) return base;
  return Math.max(min, Math.floor(((base * maxWidth) / width) * 4) / 4);
}

/**
 * Largest font size (≤ `base`, ≥ `min`, in 0.25pt steps) at which every word of `text` fits
 * `maxWidth`, counting a hyphenated word by its parts ("Maximilian-" / "Alexander": it may wrap
 * after the hyphen). For a name in a narrow column: lines break between words, and no word is
 * wider than the column.
 */
export function fitWordsFontSize(text: string, maxWidth: number, base: number, min: number, bold = false): number {
  const parts = text.split(/\s+/).flatMap((w) => w.replace(/-/g, "-\n").split("\n"));
  const widest = Math.max(0, ...parts.map((w) => textWidth(w, base, bold)));
  if (widest <= maxWidth) return base;
  return Math.max(min, Math.floor(((base * maxWidth) / widest) * 4) / 4);
}

const BREAK_AFTER = "/.-_?&=@#:;,|\\+~";

/**
 * Lets a word that is wider than `maxWidth` (a pasted URL, a long compound name) wrap instead
 * of running past the margin: marks a break after each / . - _ ? & = @ # : ; , | \ + ~ in it,
 * and, where a piece is still too wide, wherever it has to. Words that fit are untouched, so
 * ordinary text lays out exactly as before. PDF templates only — Word wraps long words itself.
 */
export function breakLongWords(text: string, maxWidth: number, fontSize = 10, bold = false): string {
  if (!text) return text;
  return text
    .split(/( +)/)
    .map((w) => (textWidth(w, fontSize, bold) <= maxWidth ? w : markBreaks(w, maxWidth, fontSize, bold)))
    .join("");
}

function markBreaks(word: string, maxWidth: number, fontSize: number, bold: boolean): string {
  // Break after a run of break characters, never inside one ("https://" stays whole).
  const chars = [...word];
  const pieces: string[] = [];
  let cur = "";
  chars.forEach((ch, i) => {
    cur += ch;
    const next = chars[i + 1];
    if (BREAK_AFTER.includes(ch) && next !== undefined && !BREAK_AFTER.includes(next)) { pieces.push(cur); cur = ""; }
  });
  if (cur) pieces.push(cur);
  const out: string[] = [];
  for (const piece of pieces) {
    if (textWidth(piece, fontSize, bold) <= maxWidth) { out.push(piece); continue; }
    let chunk = "";
    for (const ch of piece) {
      if (chunk && textWidth(chunk + ch, fontSize, bold) > maxWidth) { out.push(chunk); chunk = ""; }
      chunk += ch;
    }
    if (chunk) out.push(chunk);
  }
  return out.join(BREAK);
}
