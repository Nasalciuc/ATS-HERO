// Page breaks in the exported CVs (rules: "page breaks" in components/cv/templates/shared.tsx and
// the keep rules in lib/exportDocx.ts).
//
// PDF: one CV is rendered 13 times, each time with one more one-line bullet in the FIRST job, so
// everything after it moves down a line and page 1 ends on every kind of row in turn: a heading,
// an entry's title or company row, a bullet, a paragraph. Each page boundary is then judged the
// way a recruiter reads it. Before these rules every template failed several of these renders,
// and some CVs sent a whole section to page 2, leaving half of page 1 white.
// DOCX: Word lays the pages out itself, so the test checks the keep properties it obeys.
import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { Packer } from "docx";
import JSZip from "jszip"; // `docx` zips the document with it
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { TEMPLATES } from "@/components/cv/templates";
import { resolveTheme } from "@/components/cv/templates/theme";
import { resetGlyphCache } from "@/components/cv/templates/fonts";
import { BULLET } from "@/components/cv/templates/shared";
import { buildCvDocx } from "@/lib/exportDocx";
import { printableCv } from "@/lib/cv-print";
import { emptyCvData, type CvData, type WorkItem } from "@/lib/types";

/* ------------------------------------------------------------------ fixture */
const LONG = [
  "Led a cross-functional squad of 9 people delivering the onboarding redesign that lifted week-one activation from 31% to 44%.",
  "Designed the pricing experiment framework used by 4 product teams, cutting time-to-decision on tests from 6 weeks to 10 days.",
  "Shipped the self-serve analytics workspace adopted by 1,200 customers in its first quarter and generating EUR 2.1M ARR.",
];
const TITLES = [
  "Principal Product Manager", "Senior Product Manager", "Product Manager", "Business Analyst",
  "MSc Business Information Systems", "BSc Economic Informatics", "Product Leader of the Year (Benelux)",
  "Certified Scrum Product Owner", "Mentor, Women in Product",
];
const META = ["Northwind Analytics", "Contoso Payments", "Fabrikam Mobility", "Tailspin Retail", "University of Amsterdam", "Babes-Bolyai University"];
const HEADINGS = ["SUMMARY", "SKILLS", "EXPERIENCE", "EDUCATION", "AWARDS", "CERTIFICATIONS", "VOLUNTEERING"];

function job(id: string, role: string, company: string, start: string, end: string, description: string, cityState: string): WorkItem {
  return { id, role, company, startDate: start, endDate: end, current: !end, description, cityState, country: "" };
}

function sweepCv(k: number): CvData {
  const d = emptyCvData();
  const extra = Array.from({ length: k }, (_, j) => `Kept the release notes current (item ${j + 1}).`);
  d.personalInfo = { ...d.personalInfo, name: `Sweep ${k}`, email: "sweep@example.com", phone: "+40 700 000 000", cityState: "Cluj-Napoca", country: "Romania" };
  d.summary = {
    position: "Product Manager",
    valueProposition: "Product leader with 15 years across B2B SaaS, payments and mobility. I turn ambiguous problems into shipped products: grew a self-serve analytics line from zero to EUR 9M ARR, rebuilt onboarding to lift activation by 13 points, and set up the experimentation practice four teams still use.",
  };
  d.skills = ["Roadmapping", "SQL", "A/B testing", "Pricing"];
  d.instruments = ["Looker", "Jira"];
  d.languages = [{ id: "l1", name: "Romanian", level: "Native" }, { id: "l2", name: "English", level: "C1" }];
  d.work = [
    job("w1", "Principal Product Manager", "Northwind Analytics", "March 2022", "", [...LONG.slice(0, 2), ...extra].join("\n"), "Amsterdam"),
    job("w2", "Senior Product Manager", "Contoso Payments", "June 2019", "February 2022", LONG.join("\n"), "Berlin"),
    job("w3", "Product Manager", "Fabrikam Mobility", "January 2017", "May 2019", "Owned the roadmap for the fleet analytics product.", "Munich"),
    job("w4", "Business Analyst", "Tailspin Retail", "September 2014", "December 2016", LONG.slice(1).join("\n"), "Bucharest"),
  ];
  d.education = [
    { id: "e1", institution: "University of Amsterdam", location: "Amsterdam, Netherlands", degree: "MSc Business Information Systems", minor: "", startDate: "September 2008", endDate: "July 2010", grade: "8.1/10", additional: "Thesis on pricing experiments in two-sided marketplaces." },
    { id: "e2", institution: "Babes-Bolyai University", location: "Cluj-Napoca, Romania", degree: "BSc Economic Informatics", minor: "", startDate: "October 2005", endDate: "June 2008", grade: "", additional: "" },
  ];
  d.awards = [{ id: "a1", title: "Product Leader of the Year (Benelux)", description: "", date: "2024", organisation: "Mind the Product" }];
  d.certifications = [{ id: "c1", title: "Certified Scrum Product Owner", description: "", date: "2018", issuer: "Scrum Alliance" }];
  d.volunteering = [{ id: "v1", title: "Mentor, Women in Product", description: "Mentored 12 aspiring product managers.\nRan a monthly portfolio review clinic.", date: "2023" }];
  return d;
}

/* ------------------------------------------------------------- PDF reading */
type Item = { str: string; x: number; y: number };
type Row = { kind: "heading" | "title" | "meta" | "bullet" | "lone-marker" | "plain"; text: string; x: number; y: number; items: Item[] };

const A4_H = 841.89;
const MAIN_X: Record<string, number> = { classic: 0, minimal: 0, modern: 595.28 * 0.34 }; // Modern: main column only
const MARGIN: Record<string, number> = { classic: 38, minimal: 46, modern: 30 }; // page padding, top = bottom
// The keep rules can leave at most a heading + an entry header + 3 lines (~115pt) empty at the
// bottom of a page; more means something that could have started there was pushed over whole.
const MAX_EMPTY = 150;

function classify(text: string): Row["kind"] {
  if (HEADINGS.includes(text)) return "heading";
  if (text === "•") return "lone-marker";
  if (text.startsWith("•")) return "bullet";
  if (TITLES.some((t) => text.startsWith(t))) return "title";
  if (META.some((t) => text.startsWith(t))) return "meta";
  return "plain";
}

/** Rows of the main column, top to bottom, for every page. */
async function pagesOf(buf: Buffer, templateId: string): Promise<Row[][]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, verbosity: 0 }).promise;
  const pages: Row[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const { items } = await (await doc.getPage(p)).getTextContent();
    const its: Item[] = items
      .filter((it): it is Extract<typeof it, { str: string }> => "str" in it && it.str.trim() !== "")
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }))
      .filter((it) => it.x >= MAIN_X[templateId]);
    its.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows: Item[][] = [];
    for (const it of its) {
      const last = rows[rows.length - 1];
      if (last && Math.abs(last[0].y - it.y) < 2) last.push(it);
      else rows.push([it]);
    }
    pages.push(rows.map((r) => {
      r.sort((a, b) => a.x - b.x);
      const text = r.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
      return { kind: classify(text), text, x: r[0].x, y: r[0].y, items: r };
    }));
  }
  return pages;
}

const first0 = (rows: Row[]) => rows[0]?.text ?? "";

/** Every rule a page boundary breaks, as readable strings (empty = good). */
function breakProblems(pages: Row[][], templateId: string): string[] {
  const out: string[] = [];
  pages.forEach((rows, i) => {
    if (rows.length === 0) { if (i > 0) out.push(`page ${i + 1} is empty`); return; }
    for (const r of rows) if (r.kind === "lone-marker") out.push(`page ${i + 1}: a bullet marker without its text`);
    if (i > 0 && A4_H - rows[0].y < MARGIN[templateId] + 5) out.push(`page ${i + 1} starts inside the top margin: ${rows[0].text}`);
    if (rows[rows.length - 1].y < MARGIN[templateId]) out.push(`page ${i + 1} ends inside the bottom margin: ${rows[rows.length - 1].text}`);
    const next = pages[i + 1];
    if (!next || next.length === 0) return;
    const last = rows[rows.length - 1];
    if (last.y - MARGIN[templateId] > MAX_EMPTY) out.push(`page ${i + 1} ends ${Math.round(last.y - MARGIN[templateId])}pt above its bottom margin, page ${i + 2} starts with: ${first0(next)}`);
    const [first, second] = next;
    if (last.kind === "heading") out.push(`page ${i + 1} ends with the heading ${last.text}`);
    if ((last.kind === "title" || last.kind === "meta") && ["plain", "bullet", "meta"].includes(first.kind)) {
      out.push(`page ${i + 1} ends with an entry header ("${last.text}"), its entry continues on page ${i + 2} ("${first.text}")`);
    }
    if (last.kind === "bullet" && first.kind === "plain") out.push(`page ${i + 1} ends with the first line of a bullet: ${last.text}`);
    if (first.kind === "plain" && (!second || second.kind !== "plain")) out.push(`page ${i + 2} starts with one line left over: ${first.text}`);
  });
  return out;
}

/* ------------------------------------------------------------------- tests */
describe("CV page breaks", () => {
  beforeAll(() => {
    // Same families as fonts.ts, from disk (fonts.ts uses browser URLs).
    Font.register({ family: "CvSans", src: path.join(process.cwd(), "public/fonts/Inter-Regular.ttf") });
    Font.register({ family: "CvSansBold", src: path.join(process.cwd(), "public/fonts/Inter-Bold.ttf") });
    Font.registerHyphenationCallback((w) => [w]);
  });

  for (const t of TEMPLATES) {
    it(`${t.id}: a page break leaves no heading, entry header, marker or single line alone, and no page half empty`, async () => {
      const T = t.component;
      const problems: string[] = [];
      for (let k = 0; k <= 12; k++) {
        resetGlyphCache();
        const pdf = await renderToBuffer(<T data={printableCv(sweepCv(k))} theme={resolveTheme(t.id, 1)} />);
        const pages = await pagesOf(pdf, t.id);
        expect(pages.length, `k=${k}: the sweep must break across pages`).toBeGreaterThan(1);
        problems.push(...breakProblems(pages, t.id).map((p) => `k=${k}: ${p}`));
      }
      expect(problems).toEqual([]);
    }, 60_000);
  }

  it("a wrapped bullet's lines start where its first line's text starts", async () => {
    const T = TEMPLATES[0].component;
    resetGlyphCache();
    const pages = await pagesOf(await renderToBuffer(<T data={printableCv(sweepCv(0))} theme={resolveTheme("classic", 1)} />), "classic");
    // The fonts are loaded now: the marker + its letter-spacing + one space must equal the indent.
    type Metrics = { unitsPerEm: number; glyphForCodePoint(c: number): { advanceWidth: number } }; // fontkit
    const fonts = Font.getRegisteredFonts();
    const bold = fonts.CvSansBold.sources[0].data as unknown as Metrics;
    const regular = fonts.CvSans.sources[0].data as unknown as Metrics;
    const at10 = (f: Metrics, ch: string) => (f.glyphForCodePoint(ch.codePointAt(0)!).advanceWidth / f.unitsPerEm) * 10;
    expect(at10(bold, "•") + BULLET.track + at10(regular, " ")).toBeCloseTo(BULLET.indent, 3);

    // Every wrapped bullet on page 1: its second line starts exactly at the indent, and its first
    // line's text too — or up to 1pt left of it when the line is set a little tight (react-pdf
    // shrinks the spaces of a line that is a hair too long, the one after the marker included).
    const rows = pages[0];
    const wrapped = rows.flatMap((r, i) => (r.kind === "bullet" && rows[i + 1]?.kind === "plain" ? [i] : []));
    expect(wrapped.length, "the fixture has bullets that wrap").toBeGreaterThan(2);
    const starts: number[] = [];
    for (const i of wrapped) {
      const [marker, text] = rows[i].items; // pdf.js: "•", then the text (whitespace items dropped)
      expect(marker.str).toBe("•");
      expect(rows[i + 1].x - marker.x).toBeCloseTo(BULLET.indent, 2);
      starts.push(text.x - marker.x);
    }
    expect(Math.max(...starts)).toBeCloseTo(BULLET.indent, 2);
    expect(Math.min(...starts)).toBeGreaterThan(BULLET.indent - 1);
  }, 30_000);

  it("DOCX: headings and entry headers keep with what follows, bullets never split", async () => {
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildCvDocx(sweepCv(3), 1)));
    const xml = await zip.file("word/document.xml")!.async("string");
    const paras = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map(([p]) => ({
      text: [...p.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(""),
      keepNext: p.includes("<w:keepNext/>"),
      keepLines: p.includes("<w:keepLines/>"),
      bullet: p.includes("<w:numPr>"),
    }));
    const keep = (start: string) => paras.find((p) => p.text.startsWith(start))?.keepNext;

    for (const h of ["SUMMARY", "SKILLS", "WORK EXPERIENCE", "EDUCATION", "AWARDS", "CERTIFICATIONS", "VOLUNTEERING"]) {
      expect(keep(h), `${h} keeps with the next paragraph`).toBe(true);
    }
    // An entry's rows keep with the next one only while the entry goes on.
    expect(keep("Principal Product Manager")).toBe(true);
    expect(keep("Northwind Analytics")).toBe(true);
    expect(keep("MSc Business Information Systems")).toBe(true);
    expect(keep("University of Amsterdam")).toBe(true); // the thesis line follows
    expect(keep("BSc Economic Informatics")).toBe(true);
    expect(keep("Babes-Bolyai University")).toBe(false); // nothing follows in this entry
    expect(keep("Product Leader of the Year")).toBe(false);
    expect(keep("Certified Scrum Product Owner")).toBe(false);
    expect(keep("Mentor, Women in Product")).toBe(true);
    const bullets = paras.filter((p) => p.bullet);
    expect(bullets.length).toBeGreaterThan(5);
    expect(bullets.every((p) => p.keepLines)).toBe(true);
    expect(xml).not.toContain('w:val="false"');
  });
});
