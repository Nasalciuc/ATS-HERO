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

/** Paper form of a URL — no scheme, no "www.", no trailing slash ("linkedin.com/in/ana").
 *  Shorter on the page and still recognised by ATS parsers. Non-URLs pass through trimmed. */
export function displayUrl(url: string): string {
  return url.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
}

// Inter Regular advance widths in 1/1000 em for ASCII 32–126, measured with fontkit from
// public/fonts/Inter-Regular.ttf (unitsPerEm 2048). Non-ASCII falls back to a wide average.
const INTER_ADVANCE = [
  281, 288, 466, 633, 642, 982, 644, 300, 365, 365, 501, 662, 288, 460, 288, 360, 631, 407, 610, 618, 646, 593, 620, 566,
  619, 620, 288, 302, 662, 662, 662, 511, 966, 690, 654, 730, 722, 601, 590, 746, 743, 269, 571, 672, 565, 903, 753, 765,
  639, 765, 644, 642, 646, 744, 690, 985, 682, 679, 629, 365, 360, 365, 471, 456, 323, 562, 612, 571, 612, 583, 370, 613,
  591, 242, 242, 549, 242, 876, 591, 600, 612, 612, 376, 528, 327, 591, 562, 818, 546, 562, 552, 426, 333, 426, 662,
];
const NON_ASCII_ADVANCE = 640;

/** Rendered width in points of `text` set in Inter Regular at `fontSize`. */
export function textWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    units += code >= 32 && code < 127 ? INTER_ADVANCE[code - 32] : NON_ASCII_ADVANCE;
  }
  return (units * fontSize) / 1000;
}

/**
 * Font size at which `text` fits `maxWidth` on ONE line (never above `base`, never below
 * `min`, rounded down to 0.25pt). Contact tokens must never wrap: the ATS lab showed a wrapped
 * e-mail/URL is lost by every extractor (and pdf.js joins split pieces with spaces). Anything
 * still too long at `min` overflows visually but stays intact in the text layer, and the
 * pre-flight check asks the user to shorten it (e.g. a custom LinkedIn URL).
 */
export function fitFontSize(text: string, maxWidth: number, base = 9, min = 6.5): number {
  const width = textWidth(text, base);
  if (width <= maxWidth) return base;
  return Math.max(min, Math.floor(((base * maxWidth) / width) * 4) / 4);
}
