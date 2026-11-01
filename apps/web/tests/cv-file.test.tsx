// readCvFile: every upload in the app (landing card, Improve My Resume, Check Job Fit) reads the
// file in the browser through it. The CVs here are the ATS lab's synthetic people, rendered by our
// own templates and DOCX export, so the expected text is known.
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { Document, Font, Image, Page, renderToBuffer } from "@react-pdf/renderer";
import { Packer } from "docx";
import { TEMPLATES } from "@/components/cv/templates";
import { resolveTheme } from "@/components/cv/templates/theme";
import { hyphenationCallback, resetGlyphCache } from "@/components/cv/templates/fonts";
import { buildCvDocx } from "@/lib/exportDocx";
import { printableCv } from "@/lib/cv-print";
import { readCvFile } from "@/lib/cv-file";
import { wordXmlText } from "@/lib/docx-text";
import type { CvData } from "@/lib/types";

const personas = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "../../tools/ats-lab/fixtures/personas.json"), "utf8"),
) as Record<string, CvData>;
const ana = personas.ana;

const file = (bytes: Uint8Array | Buffer | string, name: string, type = "") =>
  new File([bytes as BlobPart], name, { type });

/** A 1×1 grey PNG. */
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGO4BwAAzwDNasM1BQAAAABJRU5ErkJggg==",
  "base64",
);

async function pdfOf(templateId: string, data: CvData) {
  const T = TEMPLATES.find((t) => t.id === templateId)!.component;
  resetGlyphCache();
  return renderToBuffer(<T data={printableCv(data)} theme={resolveTheme(templateId, 1)} />);
}

/** A PDF whose only content is a picture: what a scanned CV is. */
async function scannedPdf() {
  const src = `data:image/png;base64,${PNG_1PX.toString("base64")}`;
  return renderToBuffer(
    <Document>
      <Page size="A4">
        <Image src={src} style={{ width: 400, height: 400 }} />
      </Page>
    </Document>,
  );
}

beforeAll(() => {
  Font.register({ family: "CvSans", src: path.join(process.cwd(), "public/fonts/Inter-Regular.ttf") });
  Font.register({ family: "CvSansBold", src: path.join(process.cwd(), "public/fonts/Inter-Bold.ttf") });
  Font.registerHyphenationCallback(hyphenationCallback);
});

describe("readCvFile", () => {
  for (const id of ["classic", "modern"]) {
    it(`reads a ${id} PDF line by line, in reading order`, async () => {
      const res = await readCvFile(file(await pdfOf(id, ana), "cv.pdf", "application/pdf"));
      expect(res).toMatchObject({ ok: true, kind: "pdf" });
      const lines = res.ok ? res.text.split("\n") : [];
      expect(lines[0]).toBe("Ana Popescu");
      expect(lines).toContain("Frontend Engineer");
      expect(lines).toContain("EXPERIENCE");
      expect(lines).toContain("• Mentored 3 junior developers.");
      // headings and bullets on their own lines, not run together into one line per page
      expect(lines.indexOf("EXPERIENCE")).toBeLessThan(lines.indexOf("• Mentored 3 junior developers."));
    });
  }

  it("reads a Word .docx we exported", async () => {
    const buf = await Packer.toBuffer(buildCvDocx(ana, 1));
    const res = await readCvFile(file(buf, "cv.docx"));
    expect(res).toMatchObject({ ok: true, kind: "docx" });
    const lines = res.ok ? res.text.split("\n") : [];
    expect(lines[0]).toBe("Ana Popescu");
    expect(lines).toContain("• Mentored 3 junior developers."); // a Word list item keeps its bullet
  });

  it("tells a scanned PDF apart: no text layer", async () => {
    expect(await readCvFile(file(await scannedPdf(), "scan.pdf", "application/pdf"))).toEqual({ ok: false, error: "SCANNED" });
  });

  it("knows an old .doc, a picture, a spreadsheet and an empty file", async () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    expect(await readCvFile(file(ole, "cv.doc"))).toEqual({ ok: false, error: "OLD_WORD" });
    expect(await readCvFile(file(PNG_1PX, "me.png", "image/png"))).toEqual({ ok: false, error: "NOT_SUPPORTED" });
    const xlsx = new JSZip();
    xlsx.file("xl/workbook.xml", "<workbook/>");
    expect(await readCvFile(file(await xlsx.generateAsync({ type: "uint8array" }), "cv.xlsx"))).toEqual({ ok: false, error: "NOT_SUPPORTED" });
    expect(await readCvFile(file("", "cv.txt", "text/plain"))).toEqual({ ok: false, error: "EMPTY" });
    expect(await readCvFile(file("Ana\u0000\u0001", "cv.txt", "text/plain"))).toEqual({ ok: false, error: "NOT_SUPPORTED" });
  });

  it("goes by the content, not the name: a PDF called .txt is still a PDF", async () => {
    const res = await readCvFile(file(await pdfOf("classic", ana), "cv.txt", "text/plain"));
    expect(res).toMatchObject({ ok: true, kind: "pdf" });
  });

  it("reads plain text as it is", async () => {
    expect(await readCvFile(file("Ana Popescu\nEXPERIENCE\n", "cv.txt", "text/plain"))).toEqual({
      ok: true,
      kind: "text",
      text: "Ana Popescu\nEXPERIENCE\n",
    });
  });
});

describe("wordXmlText", () => {
  it("keeps what Word shows, once: no field codes, no deleted text, no text-box fallback", () => {
    const xml = `<w:document><w:body>
      <w:p><w:r><w:t>Ana</w:t></w:r><w:r><w:tab/><w:t xml:space="preserve">Popescu &amp; Co</w:t></w:r></w:p>
      <w:p><w:r><w:instrText>HYPERLINK "https://x.example"</w:instrText></w:r><w:r><w:t>linkedin.com/in/ana</w:t></w:r></w:p>
      <w:p><w:r><w:delText>deleted</w:delText></w:r><w:r><w:t>kept</w:t></w:r><w:r><w:br/><w:t>next line</w:t></w:r></w:p>
      <w:p><w:r><mc:AlternateContent><mc:Choice><w:txbxContent><w:p><w:r><w:t>In a text box</w:t></w:r></w:p></w:txbxContent></mc:Choice>
        <mc:Fallback><w:txbxContent><w:p><w:r><w:t>In a text box</w:t></w:r></w:p></w:txbxContent></mc:Fallback></mc:AlternateContent></w:r></w:p>
      <w:p/><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell 1</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Cell 2</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      <w:p w:rsidR="1"><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Led a team</w:t></w:r></w:p>
    </w:body></w:document>`;
    expect(wordXmlText(xml).split("\n")).toEqual([
      "Ana Popescu & Co",
      "linkedin.com/in/ana",
      "kept",
      "next line",
      "In a text box",
      "Cell 1",
      "Cell 2",
      "• Led a team",
    ]);
  });

  it("reads the page header first: Word CV templates keep the name and contacts there", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", "<w:document><w:body><w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p></w:body></w:document>");
    zip.file("word/header1.xml", "<w:hdr><w:p><w:r><w:t>Ana Popescu</w:t></w:r></w:p></w:hdr>");
    zip.file("word/header2.xml", "<w:hdr><w:p><w:r><w:t>Ana Popescu</w:t></w:r></w:p></w:hdr>");
    const res = await readCvFile(file(await zip.generateAsync({ type: "uint8array" }), "cv.docx"));
    expect(res).toMatchObject({ ok: true, kind: "docx", text: "Ana Popescu\nEXPERIENCE" });
  });
});
