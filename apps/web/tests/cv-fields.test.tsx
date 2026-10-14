// What the builder collects is what the exports print — and nothing that was not typed:
// the minor of a degree and the role, type, place and end date of volunteering / activities
// used to be dropped; an empty title printed "—" and an empty name printed "Your Name".
import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { Packer } from "docx";
import JSZip from "jszip"; // `docx` zips the document with it
import { TEMPLATES } from "@/components/cv/templates";
import { resolveTheme } from "@/components/cv/templates/theme";
import { hyphenationCallback, resetGlyphCache } from "@/components/cv/templates/fonts";
import { buildCvDocx } from "@/lib/exportDocx";
import { printableCv } from "@/lib/cv-print";
import { emptyCvData, type CvData } from "@/lib/types";
import { pdfItems, rowsOf, rowText } from "./pdf-text";

function filledCv(): CvData {
  const d = emptyCvData();
  d.personalInfo = { ...d.personalInfo, name: "Amara Okafor", email: "amara@example.com" };
  d.education = [{ id: "e1", institution: "University of Lagos", location: "Lagos, Nigeria", degree: "BSc Statistics", minor: "Economics", startDate: "2016", endDate: "2020", grade: "", additional: "" }];
  d.volunteering = [{ id: "v1", title: "Data Science Nigeria", role: "Mentor", location: "Abuja, Nigeria", description: "Mentored 15 students.", date: "March 2022", ongoing: true }];
  d.activities = [{ id: "a1", title: "Hackathon Moldova", activityType: "Hackathon", role: "UX lead", location: "Chișinău, Moldova", description: "Won first place.", date: "May 2023", endDate: "June 2023" }];
  return d;
}

/** Only half-filled entries and no name. */
function sparseCv(): CvData {
  const d = emptyCvData();
  d.personalInfo = { ...d.personalInfo, email: "radu@example.com" };
  d.work = [{ id: "w1", role: "", company: "Acme SRL", description: "Kept the books.", startDate: "2020", endDate: "2021", current: false, country: "", cityState: "" }];
  d.education = [{ id: "e1", institution: "Liceul Teoretic", location: "", degree: "", minor: "", startDate: "2012", endDate: "2016", grade: "", additional: "" }];
  d.certifications = [{ id: "c1", title: "", description: "", date: "2019", issuer: "Cisco" }];
  return d;
}

async function pdfText(templateId: string, data: CvData): Promise<string> {
  const T = TEMPLATES.find((t) => t.id === templateId)!.component;
  resetGlyphCache();
  const pages = await pdfItems(await renderToBuffer(<T data={printableCv(data)} theme={resolveTheme(templateId, 1)} />));
  return pages.flatMap((items) => rowsOf(items).map(rowText)).join("\n").replace(/ /g, " ");
}

async function docxXml(data: CvData): Promise<string> {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(buildCvDocx(data, 1)));
  return zip.file("word/document.xml")!.async("string");
}
const docxText = (xml: string) => [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)]
  .map(([p]) => [...p.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(" "))
  .join("\n");

const PRINTED = ["Minor in Economics", "Mentor", "Abuja, Nigeria", "March 2022 – Present", "UX lead", "Hackathon", "Chișinău, Moldova", "May 2023 – June 2023"];

describe("collected fields are printed", () => {
  beforeAll(() => {
    Font.register({ family: "CvSans", src: path.join(process.cwd(), "public/fonts/Inter-Regular.ttf") });
    Font.register({ family: "CvSansBold", src: path.join(process.cwd(), "public/fonts/Inter-Bold.ttf") });
    Font.registerHyphenationCallback(hyphenationCallback);
  });

  for (const t of TEMPLATES) {
    it(`${t.id}: minor, role, type, place and end date / Present`, async () => {
      const text = await pdfText(t.id, filledCv());
      for (const s of PRINTED) expect(text).toContain(s);
    }, 30_000);

    it(`${t.id}: no "—" for a missing title, no "Your Name" for a missing name`, async () => {
      const text = await pdfText(t.id, sparseCv());
      expect(text).not.toContain("—");
      expect(text).not.toContain("Your Name");
      for (const s of ["Acme SRL", "Liceul Teoretic", "Cisco"]) expect(text).toContain(s);
    }, 30_000);
  }

  it("DOCX: the same fields, no placeholders, dates on the right margin of A4", async () => {
    const text = docxText(await docxXml(filledCv()));
    for (const s of PRINTED) expect(text).toContain(s);

    const sparse = await docxXml(sparseCv());
    expect(docxText(sparse)).not.toContain("—");
    expect(docxText(sparse)).not.toContain("Your Name");
    // A4 is 11906 twips wide; minus 900 on each side, the right tab stop is at 10106.
    expect(sparse).toContain('<w:pgSz w:w="11906" w:h="16838"');
    expect(sparse).toContain('<w:tab w:val="right" w:pos="10106"/>');
  });
});
