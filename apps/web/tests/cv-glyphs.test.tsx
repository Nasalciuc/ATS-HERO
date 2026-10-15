// Only characters the CV font can draw reach the PDF (components/cv/templates/glyphs.ts).
// Before: ✔ ➤, emoji and Arabic went to react-pdf's built-in Helvetica, which printed other
// letters in their place ("*'1ام%D'ïÛJ(/"), and that font was not embedded in the file.
import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { Document, Font, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { TEMPLATES } from "@/components/cv/templates";
import { resolveTheme } from "@/components/cv/templates/theme";
import { hyphenationCallback, resetGlyphCache, FONT, FONT_BOLD } from "@/components/cv/templates/fonts";
import { INTER_CHARS, drawable, undrawable } from "@/components/cv/templates/glyphs";
import { printableCv } from "@/lib/cv-print";
import { emptyCvData, type CvData } from "@/lib/types";
import { pdfItems, rowsOf, rowText } from "./pdf-text";

type FontkitFont = { characterSet: number[]; hasGlyphForCodePoint(cp: number): boolean };

beforeAll(() => {
  Font.register({ family: FONT, src: path.join(process.cwd(), "public/fonts/Inter-Regular.ttf") });
  Font.register({ family: FONT_BOLD, src: path.join(process.cwd(), "public/fonts/Inter-Bold.ttf") });
  Font.registerHyphenationCallback(hyphenationCallback);
});

describe("glyphs.ts", () => {
  it("INTER_CHARS is exactly what both font files can draw", async () => {
    // a render loads both fonts; then their glyph maps are at hand
    await renderToBuffer(<Document><Page><Text style={{ fontFamily: FONT }}>a</Text><Text style={{ fontFamily: FONT_BOLD }}>a</Text></Page></Document>);
    const fonts = Font.getRegisteredFonts();
    const regular = fonts[FONT].sources[0].data as unknown as FontkitFont;
    const bold = fonts[FONT_BOLD].sources[0].data as unknown as FontkitFont;
    const cps = regular.characterSet
      .filter((cp) => cp >= 0x20 && !(cp >= 0xe000 && cp <= 0xf8ff) && cp !== 0xfeff && bold.hasGlyphForCodePoint(cp))
      .sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = cps[0];
    cps.forEach((cp, i) => {
      if (cps[i + 1] !== cp + 1) {
        ranges.push(start === cp ? cp.toString(16) : `${start.toString(16)}-${cp.toString(16)}`);
        start = cps[i + 1];
      }
    });
    // If the fonts change, paste this value into glyphs.ts.
    expect(INTER_CHARS).toBe(ranges.join(","));
  });

  it("keeps what Inter draws, swaps look-alikes, leaves out the rest", () => {
    expect(drawable("Ștefănescu, Łódź, İğdır, Привет, Γειά — 40 % ✓")).toBe("Ștefănescu, Łódź, İğdır, Привет, Γειά — 40 % ✓");
    expect(drawable("✔ done ➤ next ⭐")).toBe("✓ done › next ★");
    expect(drawable("Launch 🚀 day")).toBe("Launch day");
    expect(drawable("مهندسة برمجيات. Mixed: React و TypeScript.\nسطر\nGo")).toBe("Mixed: React TypeScript.\nGo");
    expect(undrawable("Ana 🚀 مرحبا ✔")).toEqual(["🚀", "م", "ر", "ح", "ب", "ا"]);
  });
});

function symbolCv(): CvData {
  const d = emptyCvData();
  d.personalInfo = { ...d.personalInfo, name: "Ștefan Țurcanu 🚀", email: "stefan@example.ro" };
  d.summary = { position: "", valueProposition: "Ships things ✔ fast ➤ and well." };
  d.work = [{ id: "w1", role: "Engineer", company: "Acme", startDate: "2020", endDate: "", current: true, country: "", cityState: "",
    description: "▪ First pasted bullet\n✓ Second pasted bullet\n Third, from Word\nمرحبا" }];
  return d;
}

describe("PDF text the font cannot draw", () => {
  for (const t of TEMPLATES) {
    it(`${t.id}: no stand-in Helvetica, look-alikes instead, pasted markers removed`, async () => {
      const T = t.component;
      resetGlyphCache();
      const buf = await renderToBuffer(<T data={printableCv(symbolCv())} theme={resolveTheme(t.id, 1)} />);
      expect(Buffer.from(buf).toString("latin1")).not.toContain("/Helvetica");
      const rows = (await pdfItems(buf)).flatMap((items) => rowsOf(items).map(rowText));
      const text = rows.join("\n");
      expect(text).toContain("Ștefan Țurcanu");
      expect(text).toContain("Ships things ✓ fast › and well.");
      expect(text).not.toMatch(/[🚀▪�]/u);
      // our own marker, once: the pasted ones are gone; the Arabic-only line is left out
      expect(rows.filter((r) => r.startsWith("•"))).toEqual(["• First pasted bullet", "• Second pasted bullet", "• Third, from Word"]);
    }, 30_000);
  }
});
