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

let registered = false;

export function registerFonts(): void {
  if (registered) return;

  // Two family names so templates can keep `fontFamily: FONT` / `fontFamily: FONT_BOLD`.
  Font.register({ family: "CvSans", src: "/fonts/Inter-Regular.ttf" });
  Font.register({ family: "CvSansBold", src: "/fonts/Inter-Bold.ttf" });

  // Names/words shouldn't break mid-word with a hyphen (e.g. "Nasalci-uc").
  Font.registerHyphenationCallback((word) => [word]);

  // NOTE on server-side export: a "/fonts/..." URL resolves in the browser (client-side
  // download). If you render the PDF in an API route, pass an absolute URL or a filesystem
  // path instead, e.g. `${process.env.NEXT_PUBLIC_APP_URL}/fonts/Inter-Regular.ttf`.

  registered = true;
}

export const FONT = "CvSans";
export const FONT_BOLD = "CvSansBold";
