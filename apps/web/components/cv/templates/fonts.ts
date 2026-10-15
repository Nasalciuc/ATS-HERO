// Font registration. @react-pdf's built-in Helvetica is ASCII-only, so non-English
// names/cities (Chișinău, Müller, Łódź) lose their diacritics — unacceptable for a
// global + Romanian audience. Registering a Unicode TTF fixes it.
//
// Validated in the build harness with a system Unicode TTF: "Chișinău" rendered with
// correct ș/ă. Here we use Inter (your UI font) the same way.
//
// SETUP (one-time): drop the Inter TTFs into apps/web/public/fonts/
//   public/fonts/Inter-Regular.ttf
//   public/fonts/Inter-Bold.ttf
// (Download from https://github.com/rsms/inter or reuse the files behind your UI font.)
import { Font } from "@react-pdf/renderer";
import { BREAK } from "@/lib/cv-print";

let registered = false;

export function registerFonts(): void {
  if (registered) return;

  // Two family names so templates can keep `fontFamily: FONT` / `fontFamily: FONT_BOLD`.
  Font.register({ family: "CvSans", src: "/fonts/Inter-Regular.ttf" });
  Font.register({ family: "CvSansBold", src: "/fonts/Inter-Bold.ttf" });

  Font.registerHyphenationCallback(hyphenationCallback);

  // NOTE on server-side export: a "/fonts/..." URL resolves in the browser (client-side
  // download). If you render the PDF in an API route, pass an absolute URL or a filesystem
  // path instead, e.g. `${process.env.NEXT_PUBLIC_APP_URL}/fonts/Inter-Regular.ttf`.

  registered = true;
}

/**
 * How react-pdf may split a word across lines. Never with a hyphen (names looked broken:
 * "Nasalci-uc"); a word marked by breakLongWords() (lib/cv-print.ts) may wrap at its BREAK
 * marks: the "" between the pieces is a zero-width space to react-pdf's line breaker, and the
 * marks themselves are dropped. Every renderer (app, ATS lab, tests) registers this function.
 */
export function hyphenationCallback(word: string): string[] {
  if (!word.includes(BREAK)) return [word];
  const parts: string[] = [];
  word.split(BREAK).forEach((piece, i) => {
    if (i > 0) parts.push("");
    if (piece) parts.push(piece);
  });
  return parts;
}

/**
 * Clears fontkit's per-font glyph cache. Call it before every render.
 *
 * fontkit 2.0.4 (used by @react-pdf 4.5) caches each glyph with the characters of the first text
 * that needed it. Inter builds some glyphs from others (’ from the comma shape, "." in Bold,
 * ı + dot for "i"), so after one render those cached parts carry no characters and the next PDF
 * in the same session silently drops letters: "B.Sc." becomes ".Sc.", "I’m" becomes "’m".
 * A fresh cache per render keeps every export identical to a first render.
 */
export function resetGlyphCache(): void {
  for (const family of Object.values(Font.getRegisteredFonts())) {
    for (const source of family.sources) {
      const font = source.data as { _glyphs?: Record<number, unknown> } | null;
      if (font?._glyphs) font._glyphs = {};
    }
  }
}

export const FONT = "CvSans";
export const FONT_BOLD = "CvSansBold";
