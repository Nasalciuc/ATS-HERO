// Regression test for lost letters in PDF exports (fontkit glyph cache, see fonts.ts).
// Renders one CV, then another in the same process (as the Complete pop-up's preview + Download
// do) and checks the second PDF's text layer word for word.
import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { TEMPLATES } from "@/components/cv/templates";
import { resolveTheme } from "@/components/cv/templates/theme";
import { hyphenationCallback, resetGlyphCache } from "@/components/cv/templates/fonts";
import { printableCv } from "@/lib/cv-print";
import { emptyCvData, type CvData } from "@/lib/types";

async function textOf(buf: Buffer): Promise<string> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, verbosity: 0 }).promise;
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const { items } = await (await doc.getPage(p)).getTextContent();
    out += items.map((it) => ("str" in it ? it.str : "")).join("") + "\n";
  }
  return out;
}

function cv(name: string, summary: string, degree: string): CvData {
  const d = emptyCvData();
  d.personalInfo = { ...d.personalInfo, name, email: "test@example.com" };
  d.summary = { ...d.summary, valueProposition: summary };
  d.education = [{ id: "e1", institution: "Universitatea Tehnică a Moldovei", location: "Chișinău", degree, minor: "", startDate: "2017", endDate: "2021", grade: "", additional: "" }];
  return d;
}

describe("PDF export keeps every letter when several CVs render in one session", () => {
  beforeAll(() => {
    // Same families as fonts.ts, from disk (fonts.ts uses browser URLs).
    Font.register({ family: "CvSans", src: path.join(process.cwd(), "public/fonts/Inter-Regular.ttf") });
    Font.register({ family: "CvSansBold", src: path.join(process.cwd(), "public/fonts/Inter-Bold.ttf") });
    Font.registerHyphenationCallback(hyphenationCallback);
  });

  const first = cv("Mihai Ionescu", "Backend developer, Iğdır office, it’s fine.", "M.Sc. Data Science");
  const target = cv("Ana O’Brien", "I’m a QA engineer; it’s my team’s job.", "B.Sc. Computer Science");

  for (const t of TEMPLATES) {
    it(`${t.id}: the second PDF is as complete as a first render`, async () => {
      const T = t.component;
      resetGlyphCache();
      await renderToBuffer(<T data={printableCv(first)} theme={resolveTheme(t.id, 1)} />);
      resetGlyphCache();
      const text = await textOf(await renderToBuffer(<T data={printableCv(target)} theme={resolveTheme(t.id, 1)} />));
      for (const s of ["I’m a QA engineer", "it’s my team’s job", "B.Sc. Computer Science", "Ana O’Brien"]) {
        expect(text.replace(/\s+/g, " ")).toContain(s);
      }
    }, 30_000);
  }
});
