// What the files say about themselves: the person is the author (it said "ATS Hero"), the PDF
// is version 1.4 (the templates use transparency) with a language and clickable contacts, and
// the DOCX marks its section titles as Word headings and its text as English.
import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { Packer } from "docx";
import JSZip from "jszip"; // `docx` zips the document with it
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { TEMPLATES } from "@/components/cv/templates";
import { resolveTheme } from "@/components/cv/templates/theme";
import { hyphenationCallback, resetGlyphCache } from "@/components/cv/templates/fonts";
import { buildCvDocx } from "@/lib/exportDocx";
import { printableCv } from "@/lib/cv-print";
import { emptyCvData, type CvData } from "@/lib/types";

function cv(name = "Ana Popescu"): CvData {
  const d = emptyCvData();
  d.personalInfo = {
    ...d.personalInfo, name, email: "ana.popescu@example.com", phone: "+40 721 234 567",
    website: "anapopescu.dev", linkedin: "https://www.linkedin.com/in/ana-popescu?utm_source=share",
  };
  d.summary = { position: "Frontend Engineer", valueProposition: "Builds accessible web apps." };
  d.publications = [{ id: "p1", title: "Accessible charts", description: "", date: "2024", publisher: "Smashing", link: "smashingmagazine.com/2024/accessible-charts" }];
  return d;
}

async function render(templateId: string, data: CvData) {
  const T = TEMPLATES.find((t) => t.id === templateId)!.component;
  resetGlyphCache();
  const buf = await renderToBuffer(<T data={printableCv(data)} theme={resolveTheme(templateId, 1)} />);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, verbosity: 0 }).promise;
  const { info } = (await doc.getMetadata()) as unknown as { info: Record<string, unknown> };
  const links = (await (await doc.getPage(1)).getAnnotations()).filter((a) => a.subtype === "Link").map((a) => a.url as string);
  return { header: new TextDecoder().decode(buf.subarray(0, 8)), info, links };
}

describe("file metadata and links", () => {
  beforeAll(() => {
    Font.register({ family: "CvSans", src: path.join(process.cwd(), "public/fonts/Inter-Regular.ttf") });
    Font.register({ family: "CvSansBold", src: path.join(process.cwd(), "public/fonts/Inter-Bold.ttf") });
    Font.registerHyphenationCallback(hyphenationCallback);
  });

  for (const t of TEMPLATES) {
    it(`${t.id}: PDF 1.4, English, the person as author, clickable contacts`, async () => {
      const { header, info, links } = await render(t.id, cv());
      expect(header).toBe("%PDF-1.4");
      expect(info.Language).toBe("en");
      expect(info.Author).toBe("Ana Popescu");
      expect(info.Title).toBe("Ana Popescu — CV");
      expect(info.Subject).toBe("Frontend Engineer");
      const web = (u: string) => (u.startsWith("http") ? new URL(u).href : u); // pdf.js normalises URLs
      expect(new Set(links)).toEqual(new Set([
        "mailto:ana.popescu@example.com",
        "tel:+40721234567",
        "https://anapopescu.dev",
        "https://linkedin.com/in/ana-popescu",
        "https://smashingmagazine.com/2024/accessible-charts",
      ].map(web)));

      const anonymous = await render(t.id, cv(""));
      expect(anonymous.info.Author ?? "").toBe(""); // not "ATS Hero"
      expect(anonymous.info.Title).toBe("CV");
    }, 30_000);
  }

  it("DOCX: the person as author, English, sections as Word headings", async () => {
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildCvDocx(cv(), 1)));
    const core = await zip.file("docProps/core.xml")!.async("string");
    const styles = await zip.file("word/styles.xml")!.async("string");
    const doc = await zip.file("word/document.xml")!.async("string");
    expect(core).toContain("<dc:creator>Ana Popescu</dc:creator>");
    expect(core).toContain("<cp:lastModifiedBy>Ana Popescu</cp:lastModifiedBy>");
    expect(core).not.toContain("ATS Hero");
    expect(styles).toContain('<w:lang w:val="en-US"/>');
    const headings = [...doc.matchAll(/<w:p>(?:(?!<\/w:p>)[\s\S])*?<w:pStyle w:val="Heading1"\/>[\s\S]*?<\/w:p>/g)]
      .map(([p]) => [...p.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(""));
    expect(headings).toEqual(["SUMMARY", "PUBLICATIONS"]);
  });
});
