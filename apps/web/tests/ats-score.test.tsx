// The ATS check (lib/ats-read/score.ts): fields read and findings on the parsers' levels, no score.
// It must rank layouts the way the ATS lab does, never react to length or stray keywords, give the
// same answer every time, and give every finding a level, a reason and a fix. All files are built
// here from the lab's synthetic people or hand-made Word XML (AGENTS.md rule 11).
// Design: ATS-REAL-VS-NOI.md §5 (claude.ai Project "App Builder").
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
import { ISSUE_LEVELS } from "@/lib/ats-read/levels";
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

/** Every finding has a level from the table, a reason and a fix. */
function explained(r: AtsReport) {
  for (const i of r.issues) {
    expect(ISSUE_LEVELS[i.code], i.code).toBeDefined();
    expect(i.level).toBe(ISSUE_LEVELS[i.code].level);
    expect(i.why.length && i.fix.length).toBeTruthy();
  }
  expect(r.fields.read).toBeLessThanOrEqual(r.fields.total);
}
const codes = (r: AtsReport) => r.issues.map((i) => i.code);

describe("no score, and nothing that moves one", () => {
  it("a recipe with an email, a phone and a LinkedIn address: one critical finding, no sections", () => {
    const r = scoreText(RECIPE, TODAY);
    expect(r.worst).toBe("critical");
    expect(codes(r)).toContain("no_sections");
    // a missing section is one finding, not one per section
    for (const c of ["no_jobs", "no_education", "no_skills", "heading_experience"]) expect(codes(r)).not.toContain(c);
    expect(r.message).toMatch(/Most important: no sections found\./);
    explained(r);
  });

  it("the report has no score in it: no points, no /100", () => {
    const json = JSON.stringify(scoreText(RECIPE, TODAY));
    expect(json).not.toMatch(/generalScore|"points"|\/100|\bpts\b/);
  });

  it("length doesn't change it: the same recipe three times reads the same", () => {
    const once = scoreText(RECIPE, TODAY);
    const thrice = scoreText(`${RECIPE}\n${RECIPE}\n${RECIPE}`, TODAY);
    expect(thrice.fields).toEqual(once.fields);
    expect(thrice.counts).toEqual(once.counts);
  });

  it("a clear CV pasted as text: every field read, nothing found", () => {
    const r = scoreText(ANA_TEXT, TODAY);
    expect(r.fields).toEqual({ read: 8, total: 8 }); // name, email, phone, LinkedIn, 2 jobs, 1 degree, skills list
    expect(r.worst).toBeNull();
    expect(r.issues).toEqual([]);
    expect(r.notes.map((n) => n.code)).toEqual(["pasted_text"]);
    expect(r.monthsOfExperience).toBe(90); // June 2019 – Nov 2026, both months counted
    expect(r.message).toBe("The reader got your name, email, phone, both jobs with their dates and 6 skills. Nothing the profile needs is lost.");
  });

  it("the same file twice gives exactly the same report", async () => {
    const pdf = await pdfOf("modern", personas.mihai);
    expect(await scoreFile(pdf)).toEqual(await scoreFile(pdf));
  });
});

describe("it ranks layouts the way the ATS lab measures them", () => {
  for (const id of Object.keys(personas)) {
    it(`${id}: Classic, Minimal and Word read in full; the two-column Modern gets a critical finding`, async () => {
      const classic = await scoreFile(await pdfOf("classic", personas[id]));
      const minimal = await scoreFile(await pdfOf("minimal", personas[id]));
      const modern = await scoreFile(await pdfOf("modern", personas[id]));
      const word = await scoreFile(new Uint8Array(await Packer.toBuffer(buildCvDocx(personas[id]))));
      for (const r of [classic, minimal, word]) {
        expect(r.fields.read).toBe(r.fields.total);
        expect(r.worst === null || r.worst === "tip").toBe(true);
      }
      expect(codes(classic)).toContain("pdf"); // the tip every PDF gets, with both facts
      expect(word.worst).toBeNull();
      expect(modern.worst).toBe("critical");
      expect(codes(modern)).toContain("two_columns");
      expect(modern.fields.read).toBeLessThanOrEqual(classic.fields.read);
      for (const r of [classic, minimal, modern, word]) explained(r);
    });
  }
});

describe("Word layouts people send", () => {
  it("one column, contacts in the page, standard headings: every field read, nothing found", async () => {
    const r = await scoreFile(await docx(PLAIN));
    expect(r.fields.read).toBe(r.fields.total);
    expect(r.worst).toBeNull();
    expect(r.message).toMatch(/^Both readers got your name, email, phone, both jobs with their dates and 5 skills\./);
  });

  it("creative headings (“Where I've made an impact”) and dates like “Mar '21 – now”: no sections", async () => {
    const r = await scoreFile(await docx(CREATIVE));
    expect(r.worst).toBe("critical");
    expect(codes(r)).toContain("no_sections");
    explained(r);
  });

  it("contacts only in the page header: a major finding, and those fields don't count as read", async () => {
    const r = await scoreFile(await docx(JOBS, p("Elena Rusu") + CONTACTS));
    expect(codes(r)).toContain("contacts_outside_body");
    expect(r.issues.find((i) => i.code === "contacts_outside_body")!.level).toBe("major");
    expect(r.fields.read).toBeLessThan(r.fields.total);
    explained(r);
  });

  it("a whole-page sidebar table: the strict reading glues headings to the sidebar", async () => {
    const sidebar = `${p("Elena Rusu")}${CONTACTS}${p("Skills")}${p("Python, SQL, Power BI")}`;
    const main = JOBS.replace(p("Skills") + p("Python, SQL, Power BI, Tableau, Excel"), "");
    const table = `<w:tbl><w:tr><w:tc>${sidebar}</w:tc><w:tc>${main}</w:tc></w:tr></w:tbl>`;
    const r = await scoreFile(await docx(table));
    expect(codes(r)).toContain("tables");
    expect(r.fields.read).toBeLessThan(r.fields.total);
    explained(r);
  });

  it("a file over 2.5 MB: critical, with Greenhouse's limit, and the fields are still shown", async () => {
    const r = await scoreFile(await docx(PLAIN, undefined, { "word/media/padding.bin": new Uint8Array(ATS_SIZE_LIMIT_BYTES + 1024) }));
    expect(r.issues[0].code).toBe("over_size");
    expect(r.issues[0].level).toBe("critical");
    expect(r.issues[0].why).toMatch(/Greenhouse doesn't parse files over 2\.5 MB/);
    expect(r.fields.read).toBe(r.fields.total);
  });

  it("a file over 1 MB: a tip with Taleo's default limit", async () => {
    const r = await scoreFile(await docx(PLAIN, undefined, { "word/media/padding.bin": new Uint8Array(1024 * 1024 + 1024) }));
    expect(r.issues.map((i) => [i.code, i.level])).toEqual([["size_taleo", "tip"]]);
  });

  it("a missing Skills section is one finding: no “heading” finding on top", async () => {
    const r = await scoreFile(await docx(JOBS.replace(p("Skills") + p("Python, SQL, Power BI, Tableau, Excel"), "")));
    expect(codes(r)).toContain("no_skills");
    expect(codes(r)).not.toContain("heading_skills");
    expect(r.issues.find((i) => i.code === "no_skills")!.level).toBe("tip");
  });
});

describe("fixing a problem removes the finding and adds a field", () => {
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
    expect(codes(hidden)).toContain("linkedin_hidden");
    expect(hidden.issues.find((i) => i.code === "linkedin_hidden")!.level).toBe("missing");
    expect(codes(visible)).not.toContain("linkedin_hidden");
    expect(visible.fields.read).toBe(hidden.fields.read + 1);
    expect(visible.fields.total).toBe(hidden.fields.total);
    explained(hidden);
  });
});

describe("the levels table (ATS-REAL-VS-NOI.md §5.1)", () => {
  it("says the same as the design doc", () => {
    const doc: Record<string, string> = {
      no_sections: "critical", no_jobs: "critical", jobs_no_dates: "critical", no_education: "critical",
      two_columns: "critical", contacts_missing: "critical", over_size: "critical",
      name_missing: "major", name_mixed: "major", contacts_outside_body: "major", jobs_disagree: "major",
      heading_experience: "major", heading_education: "major", heading_skills: "major", education_disagree: "major",
      skills_list_disagree: "major", skills_unsearchable: "major", skills_ligatures: "major", ligatures: "major",
      broken_glyphs: "major", tables: "major", text_boxes: "major", email_partial: "major", phone_partial: "major",
      linkedin_cut: "major",
      email_missing: "missing", phone_missing: "missing", company_missing: "missing", linkedin_hidden: "missing",
      linkedin_no_address: "missing",
      education_no_dates: "tip", no_skills: "tip", skills_unlisted: "tip", diacritics: "tip", pdf: "tip", size_taleo: "tip",
    };
    expect(Object.fromEntries(Object.entries(ISSUE_LEVELS).map(([k, v]) => [k, v.level]))).toEqual(doc);
    expect(ISSUE_LEVELS.two_columns.ref).toMatchObject({ textkernel: "433", rchilli: "4108" });
    expect(ISSUE_LEVELS.pdf.ref.deviation).toBeTruthy();
  });

  it("no email and no phone is one critical finding", () => {
    const r = scoreText("Elena Rusu\nExperience\nData Analyst, Moldcell, June 2018 – February 2021\nEducation\nBSc, TUM, 2014 – 2018\nSkills\nSQL", TODAY);
    expect(codes(r)).toContain("contacts_missing");
    expect(codes(r)).not.toContain("email_missing");
    expect(codes(r)).not.toContain("phone_missing");
  });
});

describe("the bullet counter", () => {
  it("joins a bullet wrapped over lines and counts results like 35+, 6 months, 78%", async () => {
    const { contentCounts } = await import("@/lib/ats-read/score");
    const job = {
      start: "2021",
      end: "now",
      text: [
        "Senior Go Developer, Reco, 2021 – now",
        "- Own 35+ SaaS integrations across services.",
        "- Resolved incidents by improving observability and",
        "reliability workflows; reduced MTTR by 35%.",
        "- Cut p95 latency from 480 ms to 120 ms.",
        "- Contributed to backend reliability.",
      ].join("\n"),
    };
    expect(contentCounts([job])).toEqual({ bullets: 4, withResult: 3, percentNoBase: 1 });
  });
});

describe("the line that says what the file is", () => {
  it("names the program that made it, the size and the columns", async () => {
    const { fileLine, producerName } = await import("@/lib/ats-read/score");
    expect(producerName("Skia/PDF m150 Google Docs Renderer")).toBe("Google Docs");
    expect(producerName("Microsoft® Word for Microsoft 365")).toBe("Microsoft Word");
    expect(producerName("pdfTeX-1.40.25")).toBe("LaTeX");
    expect(producerName(null)).toBeNull();
    const r = await scoreFile(await pdfOf("modern", personas.ana));
    expect(fileLine(r)).toMatch(/^PDF made with ATS Hero · 1 page · \d+ KB · two columns · read in your browser$/);
    expect(fileLine(scoreText(ANA_TEXT, TODAY))).toBe("Pasted text · the file's layout isn't checked");
  });

  it("contacts only in the header are one issue, not one per field", async () => {
    const r = await scoreFile(await docx(JOBS, p("Elena Rusu") + CONTACTS));
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain("contacts_outside_body");
    expect(codes).not.toContain("linkedin_cut");
    expect(codes).not.toContain("name_mixed");
  });
});

describe("the CV's language", () => {
  const RU = `Елена Русу
elena.rusu@example.com | +373 69 555 012
Опыт работы
Старший аналитик данных, Orange Moldova, 03.2021 – по настоящее время
• Создала 12 дашбордов Power BI
Аналитик данных, Moldcell, 06.2018 – 02.2021
Образование
Технический университет Молдовы, 2014 – 2018
Навыки
Python, SQL, Power BI, Excel`;
  const RO = `Elena Rusu
elena.rusu@example.com | +373 69 555 012
EXPERIENȚĂ PROFESIONALĂ
Analist de date senior, Orange Moldova, Martie 2021 – Prezent
• Am construit 12 dashboard-uri Power BI folosite de 40 de manageri
Analist de date, Moldcell, Iunie 2018 – Februarie 2021
• Am automatizat analiza churn în Python
EDUCAȚIE
Licență în Informatică, Universitatea Tehnică a Moldovei, 2014 – 2018
COMPETENȚE
Python, SQL, Power BI, Excel`;
  const notes = (r: AtsReport) => r.notes.map((n) => n.code);

  it("Russian: Taleo's language limit, and no “no sections” stated as a fact about the CV", () => {
    const r = scoreText(RU, TODAY);
    expect(r.language).toBe("ru");
    expect(notes(r)).toContain("taleo_language");
    const none = r.issues.find((i) => i.code === "no_sections");
    if (none) {
      expect(notes(r)).toContain("language_unknown");
      expect(none.title).toBe("No headings our reader knows");
    }
  });

  it("Romanian: Taleo's language limit; English: no language note", () => {
    expect(scoreText(RO, TODAY).language).toBe("ro");
    expect(notes(scoreText(RO, TODAY))).toContain("taleo_language");
    expect(scoreText(ANA_TEXT, TODAY).language).toBe("en");
    expect(notes(scoreText(ANA_TEXT, TODAY))).toEqual(["pasted_text"]);
  });
});
