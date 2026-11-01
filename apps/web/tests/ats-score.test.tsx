// The "ATS read" score (lib/ats-read/score.ts): calibration. It must rank CVs the way the ATS lab
// does, never reward length or stray keywords, give the same answer every time, and explain every
// point it takes. All files are built here from the lab's synthetic people or hand-made Word XML
// (AGENTS.md rule 11). Design: ATS-VIEW-DESIGN.md §5.
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
import { readForAts } from "@/lib/ats-read";
import { scoreRead, scoreText, type AtsReport } from "@/lib/ats-read/score";
import { ATS_SIZE_LIMIT_BYTES } from "@/lib/ats-read/types";
import type { CvData } from "@/lib/types";

const personas = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "../../tools/ats-lab/fixtures/personas.json"), "utf8"),
) as Record<string, CvData>;
const TODAY = new Date(2026, 10, 1);

const ab = (b: Uint8Array | Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
async function scoreFile(bytes: Uint8Array | Buffer): Promise<AtsReport> {
  const read = await readForAts(ab(bytes));
  if (!read) throw new Error("not read");
  return scoreRead(read, TODAY);
}
async function pdfOf(templateId: string, data: CvData) {
  const T = TEMPLATES.find((t) => t.id === templateId)!.component;
  resetGlyphCache();
  return renderToBuffer(<T data={printableCv(data)} theme={resolveTheme(templateId, 1)} />);
}

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const p = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
async function docx(body: string, header?: string, extra?: Record<string, Uint8Array>) {
  const zip = new JSZip();
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`);
  if (header) zip.file("word/header1.xml", `<?xml version="1.0"?><w:hdr ${W}>${header}</w:hdr>`);
  for (const [name, bytes] of Object.entries(extra ?? {})) zip.file(name, bytes, { compression: "STORE" });
  return zip.generateAsync({ type: "uint8array" });
}

// Elena Rusu, a synthetic person, in Word layouts people really send.
const CONTACTS = p("elena.rusu@example.com | +373 69 555 012 | linkedin.com/in/elena-rusu");
const JOBS =
  p("Experience") +
  p("Senior Data Analyst, Orange Moldova, March 2021 – Present") +
  p("• Built Power BI dashboards used by 40 managers") +
  p("Data Analyst, Moldcell, June 2018 – February 2021") +
  p("• Automated churn analysis in Python") +
  p("Education") +
  p("BSc Computer Science, Technical University of Moldova, 2014 – 2018") +
  p("Skills") +
  p("Python, SQL, Power BI, Tableau, Excel");
const PLAIN = p("Elena Rusu") + CONTACTS + JOBS;
const CREATIVE =
  p("Elena Rusu") +
  CONTACTS +
  p("Where I've made an impact") +
  p("Senior Data Analyst @ Orange Moldova (Mar '21 – now)") +
  p("• Built Power BI dashboards used by 40 managers") +
  p("What I know") +
  p("Python, SQL, Power BI, Tableau, Excel") +
  p("Learning") +
  p("Technical University of Moldova — Computer Science");

const RECIPE = `Grandma's apple pie
This is the apple pie my grandmother made every Sunday. It takes about 90 minutes, most of it in the oven.
Ingredients: 250 grams of flour, 125 grams of cold butter, 1 egg, 6 apples, 100 grams of sugar, 1 teaspoon of cinnamon.
Step 1. Rub the butter into the flour until it looks like breadcrumbs. Add the egg and bring it together into a dough.
Step 2. Peel and slice the apples. Toss them with the sugar and the cinnamon.
Step 3. Bake at 180 degrees for 50 to 55 minutes, until the top is golden.
Questions about the recipe? Write to me at grandma.bakes@example.com, call +1 555 010 2030 or find me on linkedin.com/in/grandma-bakes.`;

const ANA_TEXT = `Ana Popescu
Backend Engineer · Cluj-Napoca, Romania · ana.popescu@example.com · +40 712 345 678 · linkedin.com/in/ana-popescu
SUMMARY
Backend engineer with 6 years of experience building payment and data platforms in Python and Go.
EXPERIENCE
Senior Backend Engineer, PayFlow — March 2022 – Present
• Led the migration of the payments API to 6 services, cutting p95 latency from 480 ms to 120 ms.
Backend Engineer, DataNest — June 2019 – February 2022
• Designed a Kafka-based ingestion pipeline processing 40 million events per day.
EDUCATION
BSc Computer Science, Babeș-Bolyai University — 2015 – 2019
SKILLS
Python, Go, PostgreSQL, Kafka, AWS, Docker`;

beforeAll(() => {
  Font.register({ family: "CvSans", src: path.join(process.cwd(), "public/fonts/Inter-Regular.ttf") });
  Font.register({ family: "CvSansBold", src: path.join(process.cwd(), "public/fonts/Inter-Bold.ttf") });
  Font.registerHyphenationCallback(hyphenationCallback);
});

/** Every lost point is an issue: their points add up to 100 − score. */
function explained(r: AtsReport) {
  const lost = Math.round((100 - r.generalScore) * 10) / 10;
  const sum = Math.round(r.issues.reduce((s, i) => s + i.points, 0) * 10) / 10;
  expect(sum).toBeCloseTo(lost, 1);
  for (const i of r.issues) expect(i.why.length && i.fix.length).toBeTruthy();
}

describe("what doesn't move the score", () => {
  it("a recipe with an email, a phone and a LinkedIn address scores under 30", () => {
    const r = scoreText(RECIPE, TODAY);
    expect(r.generalScore).toBeLessThan(30);
    expect(r.verdict).toBe("FAIL");
    expect(r.issues.map((i) => i.code)).toEqual(expect.arrayContaining(["no_jobs", "no_skills", "no_education"]));
    explained(r);
  });

  it("length doesn't raise it: the same recipe three times scores the same", () => {
    expect(scoreText(`${RECIPE}\n${RECIPE}\n${RECIPE}`, TODAY).generalScore).toBe(scoreText(RECIPE, TODAY).generalScore);
  });

  it("a clear CV pasted as text reads fully", () => {
    const r = scoreText(ANA_TEXT, TODAY);
    expect(r.generalScore).toBe(100);
    expect(r.verdict).toBe("PASS");
    expect(r.monthsOfExperience).toBe(90); // June 2019 – Nov 2026, both months counted
    expect(r.issues.map((i) => i.code)).toEqual(["pasted_text"]);
  });

  it("the same file twice gives exactly the same report", async () => {
    const pdf = await pdfOf("modern", personas.mihai);
    expect(await scoreFile(pdf)).toEqual(await scoreFile(pdf));
  });
});

describe("it ranks layouts the way the ATS lab measures them", () => {
  for (const id of Object.keys(personas)) {
    it(`${id}: Classic, Minimal and Word read fully; the two-column Modern scores lower`, async () => {
      const classic = await scoreFile(await pdfOf("classic", personas[id]));
      const minimal = await scoreFile(await pdfOf("minimal", personas[id]));
      const modern = await scoreFile(await pdfOf("modern", personas[id]));
      const word = await scoreFile(new Uint8Array(await Packer.toBuffer(buildCvDocx(personas[id]))));
      expect(classic.generalScore).toBeGreaterThanOrEqual(95);
      expect(minimal.generalScore).toBeGreaterThanOrEqual(95);
      expect(word.generalScore).toBeGreaterThanOrEqual(95);
      expect(modern.generalScore).toBeLessThan(classic.generalScore);
      expect(modern.issues.some((i) => i.code === "jobs_disagree" || i.code === "two_columns")).toBe(true);
      for (const r of [classic, minimal, modern, word]) explained(r);
    });
  }
});

describe("Word layouts people send", () => {
  it("one column, contacts in the page, standard headings: full marks", async () => {
    const r = await scoreFile(await docx(PLAIN));
    expect(r.generalScore).toBe(100);
    expect(r.verdict).toBe("PASS");
  });

  it("creative headings and dates like “Mar '21 – now”: 30+ points lower", async () => {
    const plain = await scoreFile(await docx(PLAIN));
    const creative = await scoreFile(await docx(CREATIVE));
    expect(creative.generalScore).toBeLessThanOrEqual(plain.generalScore - 30);
    expect(creative.issues.map((i) => i.code)).toEqual(expect.arrayContaining(["no_jobs", "heading_experience"]));
    explained(creative);
  });

  it("contacts only in the page header: flagged, and they cost points", async () => {
    const r = await scoreFile(await docx(JOBS, p("Elena Rusu") + CONTACTS));
    expect(r.issues.map((i) => i.code)).toContain("contacts_outside_body");
    expect(r.generalScore).toBeLessThan(100);
    explained(r);
  });

  it("a whole-page sidebar table: the strict reading glues headings to the sidebar", async () => {
    const sidebar = `${p("Elena Rusu")}${CONTACTS}${p("Skills")}${p("Python, SQL, Power BI")}`;
    const main = JOBS.replace(p("Skills") + p("Python, SQL, Power BI, Tableau, Excel"), "");
    const table = `<w:tbl><w:tr><w:tc>${sidebar}</w:tc><w:tc>${main}</w:tc></w:tr></w:tbl>`;
    const r = await scoreFile(await docx(table));
    expect(r.generalScore).toBeLessThan(80);
    expect(r.issues.map((i) => i.code)).toContain("tables");
    explained(r);
  });

  it("a file over 2.5 MB is capped at 50", async () => {
    const r = await scoreFile(await docx(PLAIN, undefined, { "word/media/padding.bin": new Uint8Array(ATS_SIZE_LIMIT_BYTES + 1024) }));
    expect(r.generalScore).toBe(50);
    expect(r.issues[0].code).toBe("over_size");
    explained(r);
  });
});

describe("fixing a problem raises the score and removes the issue", () => {
  const cvPdf = (contactLine: React.ReactNode) =>
    renderToBuffer(
      <Document>
        <Page size="A4" style={{ padding: 40, fontFamily: "CvSans", fontSize: 11 }}>
          <Text>Elena Rusu</Text>
          {contactLine}
          <Text>Experience</Text>
          <Text>Senior Data Analyst, Orange Moldova, March 2021 – Present</Text>
          <Text>Education</Text>
          <Text>BSc Computer Science, Technical University of Moldova, 2014 – 2018</Text>
          <Text>Skills</Text>
          <Text>Python, SQL, Power BI</Text>
        </Page>
      </Document>,
    );

  it("a LinkedIn hidden behind the word “LinkedIn”, then written out", async () => {
    const hidden = await scoreFile(
      await cvPdf(
        <Text>
          elena.rusu@example.com | +373 69 555 012 | <Link src="https://www.linkedin.com/in/elena-rusu/">LinkedIn</Link>
        </Text>,
      ),
    );
    const visible = await scoreFile(
      await cvPdf(
        <Text>
          elena.rusu@example.com | +373 69 555 012 | <Link src="https://www.linkedin.com/in/elena-rusu/">linkedin.com/in/elena-rusu</Link>
        </Text>,
      ),
    );
    expect(hidden.issues.map((i) => i.code)).toContain("linkedin_hidden");
    expect(visible.issues.map((i) => i.code)).not.toContain("linkedin_hidden");
    expect(visible.generalScore).toBeGreaterThan(hidden.generalScore);
    explained(hidden);
  });
});
