// The ATS check's reading layer (lib/ats-read): two readings per file and the layout signals that
// explain where ATS readers differ. Everything is built here from the ATS lab's synthetic people
// (tools/ats-lab/fixtures) or hand-made Word XML; no real CV is used (AGENTS.md rule 11).
// Design: ATS-VIEW-DESIGN.md §1.6, §6, §7.
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { Document, Font, Link, Page, Text, renderToBuffer } from "@react-pdf/renderer";
import { Packer } from "docx";
import { TEMPLATES } from "@/components/cv/templates";
import { resolveTheme } from "@/components/cv/templates/theme";
import { hyphenationCallback, resetGlyphCache } from "@/components/cv/templates/fonts";
import { buildCvDocx } from "@/lib/exportDocx";
import { printableCv } from "@/lib/cv-print";
import { extractPdfText } from "@/lib/pdf";
import { readForAts } from "@/lib/ats-read";
import { ligatureWordsIn, printedForm } from "@/lib/ats-read/pdf";
import { ATS_SIZE_LIMIT_BYTES } from "@/lib/ats-read/types";
import type { CvData } from "@/lib/types";

const personas = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "../../tools/ats-lab/fixtures/personas.json"), "utf8"),
) as Record<string, CvData>;

const ab = (b: Uint8Array | Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

async function pdfOf(templateId: string, data: CvData) {
  const T = TEMPLATES.find((t) => t.id === templateId)!.component;
  resetGlyphCache();
  return renderToBuffer(<T data={printableCv(data)} theme={resolveTheme(templateId, 1)} />);
}

async function read(bytes: Uint8Array | Buffer) {
  const r = await readForAts(ab(bytes));
  if (!r) throw new Error("not read");
  return r;
}

const reading = (r: Awaited<ReturnType<typeof read>>, id: string) => r.readings.find((x) => x.reader === id)!.text;

beforeAll(() => {
  Font.register({ family: "CvSans", src: path.join(process.cwd(), "public/fonts/Inter-Regular.ttf") });
  Font.register({ family: "CvSansBold", src: path.join(process.cwd(), "public/fonts/Inter-Bold.ttf") });
  Font.registerHyphenationCallback(hyphenationCallback);
});

describe("PDF: two readings", () => {
  it("reads the stream exactly as the app's reader does today (lib/pdf.ts)", async () => {
    const pdf = await pdfOf("classic", personas.mihai);
    const r = await read(pdf);
    expect(reading(r, "pdf-stream")).toBe((await extractPdfText(ab(pdf))).text);
    expect(r.kind).toBe("pdf");
    expect(r.pages).toBe(1);
    expect(r.producer).toBe("ATS Hero");
  });

  it("reads row by row, which mixes a sidebar into the main column", async () => {
    const amara = personas.amara;
    const r = await read(await pdfOf("modern", amara));
    const mixed = (text: string) =>
      text.split("\n").some((l) => l.includes("linkedin.com/in/amaraokafor") && l.includes(amara.work[0].role));
    expect(mixed(reading(r, "pdf-rows"))).toBe(true);
    expect(mixed(reading(r, "pdf-stream"))).toBe(false);
  });
});

describe("PDF: two columns", () => {
  for (const id of Object.keys(personas)) {
    it(`finds the sidebar in ${id}'s Modern CV and none in Classic or Minimal`, async () => {
      expect((await read(await pdfOf("modern", personas[id]))).signals.twoColumns).toBe(true);
      expect((await read(await pdfOf("classic", personas[id]))).signals.twoColumns).toBe(false);
      expect((await read(await pdfOf("minimal", personas[id]))).signals.twoColumns).toBe(false);
    });
  }
});

describe("PDF: links whose address isn't printed", () => {
  const doc = (line: React.ReactNode) =>
    renderToBuffer(
      <Document>
        <Page size="A4" style={{ padding: 40, fontFamily: "CvSans", fontSize: 11 }}>
          <Text>Test Person</Text>
          {line}
        </Page>
      </Document>,
    );

  it("reports a LinkedIn address hidden behind the word “LinkedIn”, with that word", async () => {
    const r = await read(
      await doc(
        <Text>
          test@example.com • <Link src="https://www.linkedin.com/in/test-person/">LinkedIn</Link> • Chisinau
        </Text>,
      ),
    );
    expect(r.signals.hiddenLinks).toEqual([{ url: "https://www.linkedin.com/in/test-person/", label: "LinkedIn" }]);
  });

  it("says nothing when the address is printed, however it's written, or when the link is an email", async () => {
    const r = await read(
      await doc(
        <Text>
          <Link src="mailto:test@example.com">test@example.com</Link> •{" "}
          <Link src="https://www.linkedin.com/in/test-person/">linkedin.com/in/test-person</Link>
        </Text>,
      ),
    );
    expect(r.signals.hiddenLinks).toEqual([]);
  });

  it("compares addresses the way people print them", () => {
    expect(printedForm("https://www.LinkedIn.com/in/x/")).toBe("linkedin.com/in/x");
    expect(printedForm("http://github.com/x")).toBe("github.com/x");
  });

  it("our own templates never hide a link", async () => {
    for (const id of ["classic", "minimal", "modern"]) {
      expect((await read(await pdfOf(id, personas.mihai))).signals.hiddenLinks).toEqual([]);
    }
  });
});

describe("PDF: ligature glyphs", () => {
  it("names the words a glyph-keeping reader sees, even when pdf.js gives the glyph as its own item", () => {
    const items = [
      { str: "Kafka, Air", hasEOL: false },
      { str: "\uFB02", hasEOL: false },
      { str: "ow, work", hasEOL: false },
      { str: "\uFB02", hasEOL: false },
      { str: "ows.", hasEOL: true },
      { str: "\uFB01rst", hasEOL: true },
    ];
    expect(ligatureWordsIn(items)).toEqual(["Air\uFB02ow", "work\uFB02ows", "\uFB01rst"]);
  });

  it("finds none in our templates (Inter has no ligature glyphs)", async () => {
    expect((await read(await pdfOf("classic", personas.dana))).signals.ligatureWords).toEqual([]);
  });
});

// A minimal Word document: enough for readDocx and extractDocxText (word/document.xml + headers).
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const p = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
async function docx(body: string, header?: string, extra?: Record<string, Uint8Array>) {
  const zip = new JSZip();
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`);
  if (header) zip.file("word/header1.xml", `<?xml version="1.0"?><w:hdr ${W}>${header}</w:hdr>`);
  for (const [name, bytes] of Object.entries(extra ?? {})) zip.file(name, bytes, { compression: "STORE" });
  return zip.generateAsync({ type: "uint8array" });
}
const JOB = p("Experience") + p("Data Analyst, Moldcell, June 2018 – February 2021") + p("Skills") + p("SQL, Python");

describe("DOCX: two readings and the layout signals", () => {
  it("contacts only in the page header: the strict reading loses them, the full one keeps them", async () => {
    const r = await read(await docx(JOB, p("Elena Rusu") + p("elena.rusu@example.com | +373 69 555 012")));
    expect(r.signals.contactsOutsideBody).toBe(true);
    expect(reading(r, "docx-strict")).not.toContain("elena.rusu@example.com");
    expect(reading(r, "docx-all")).toContain("elena.rusu@example.com");
  });

  it("contacts in the body as well: nothing is lost", async () => {
    const r = await read(await docx(p("elena.rusu@example.com | +373 69 555 012") + JOB, p("Elena Rusu")));
    expect(r.signals.contactsOutsideBody).toBe(false);
  });

  it("counts tables, text boxes (once, without Word's fallback copy) and pictures", async () => {
    const box =
      '<w:p><w:r><mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="wps"><w:drawing><wps:wsp><wps:txbx><w:txbxContent>' +
      p("elena.rusu@example.com") +
      "</w:txbxContent></wps:txbx></wps:wsp></w:drawing></mc:Choice><mc:Fallback><w:pict><v:textbox><w:txbxContent>" +
      p("elena.rusu@example.com") +
      "</w:txbxContent></v:textbox></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>";
    const table = `<w:tbl><w:tr><w:tc>${p("2018 – 2021")}</w:tc><w:tc>${p("Data Analyst")}</w:tc></w:tr></w:tbl>`;
    const picture = '<w:p><w:r><w:drawing><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"></pic:pic></w:drawing></w:r></w:p>';
    const r = await read(await docx(box + table + picture + JOB));
    expect(r.signals).toMatchObject({ tables: 1, textBoxes: 1, images: 1, contactsOutsideBody: true });
    expect(reading(r, "docx-strict")).not.toContain("elena.rusu@example.com");
    expect(reading(r, "docx-all").split("elena.rusu@example.com").length - 1).toBe(1);
  });

  it("our own Word export has none of them", async () => {
    for (const id of Object.keys(personas)) {
      const r = await read(new Uint8Array(await Packer.toBuffer(buildCvDocx(personas[id]))));
      expect(r.signals).toMatchObject({ contactsOutsideBody: false, tables: 0, textBoxes: 0, images: 0 });
    }
  });

  it("flags a file over 2.5 MB, the size Greenhouse documents it won't parse", async () => {
    const small = await read(await docx(JOB));
    const big = await read(await docx(JOB, undefined, { "word/media/padding.bin": new Uint8Array(ATS_SIZE_LIMIT_BYTES + 1024) }));
    expect(small.signals.overSizeLimit).toBe(false);
    expect(big.signals.overSizeLimit).toBe(true);
  });
});

describe("other files", () => {
  it("are not read here (readCvFile already explains them to the person)", async () => {
    expect(await readForAts(ab(Buffer.from("just some text, not a CV file")))).toBeNull();
  });
});

describe("readCvFile hands the reading over", () => {
  it("returns the file's ATS reading with the text, and the text is its in-order reading", async () => {
    const { readCvFile } = await import("@/lib/cv-file");
    const pdf = await pdfOf("classic", personas.ana);
    const res = await readCvFile(new File([pdf as BlobPart], "cv.pdf", { type: "application/pdf" }));
    if (!res.ok) throw new Error(res.error);
    expect(res.ats?.kind).toBe("pdf");
    expect(res.ats?.readings.find((r) => r.reader === "pdf-stream")?.text).toBe(res.text);
  });
});
