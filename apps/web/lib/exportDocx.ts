// DOCX export — ATS-first. Built programmatically from CvData with the `docx` library,
// client-side (mirrors downloadCvPdf). Deliberately a SINGLE clean document, NOT a clone of
// the visual templates: the DOCX's job is reliable parsing on strict/legacy portals, so it
// is single-column, uses standard headings ("Work Experience", "Education", "Skills"), keeps
// contact in the BODY (not header/footer), uses real bullets and tab-stop alignment, and has
// no tables or text boxes. Accent shows only on heading color (brand without hurting parsing).
import {
  Document, Paragraph, TextRun, TabStopType, BorderStyle, HeadingLevel,
} from "docx";
import type { CvData, SimpleEntry } from "@/lib/types";
import { displayUrl, printableCv } from "@/lib/cv-print";

// A4 in twips (1/20 pt) and the side margins; the right tab stop sits on the right margin.
// (TabStopPosition.MAX is 9026 — Letter-sized defaults — 54pt short of this page's text edge, so
// a long title pushed its dates onto a second line.)
const PAGE_W = 11906;
const MARGIN_X = 900;
const TEXT_W = PAGE_W - 2 * MARGIN_X;

const ACCENTS = ["725BFE", "0EA5A4", "2563EB", "00A862", "E5484D", "B7791F"];
const TEXT = "2E2E2E";
const MUTED = "52525B";
const FAINT = "6B7280";

function hexAccent(accent?: number | string): string {
  if (accent == null) return ACCENTS[0];
  if (typeof accent === "number") return ACCENTS[(accent - 1) % ACCENTS.length];
  return accent.replace(/^#/, "");
}
function dateRange(start?: string, end?: string, ongoing?: boolean): string {
  return [start, ongoing ? "Present" : end].filter(Boolean).join(" – ");
}
function descLines(text?: string): string[] {
  return (text || "").split(/\r?\n/).map((s) => s.trim().replace(/^[•\-*]\s*/, "")).filter(Boolean);
}

// Page breaks (Word and LibreOffice honour these; the PDF templates follow the same rules,
// tests/cv-page-breaks.test.tsx checks both):
// a heading and an entry's header rows keep with what follows them (keepNext), a bullet never
// splits across pages (keepLines), and no paragraph leaves a single line behind (widowControl).
// Section headings use Word's "Heading 1" style (restyled below to look as before): parsers and
// Word's navigation pane recognise sections by it, not by bold capitals.
function heading(text: string, accent: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    keepNext: true,
    spacing: { before: 240, after: 80 },
    border: { bottom: { color: accent, style: BorderStyle.SINGLE, size: 8, space: 2 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, color: accent, size: 22 })],
  });
}
function split(left: string, right: string, opts: { bold?: boolean; before?: number; keepNext?: boolean } = {}): Paragraph {
  return new Paragraph({
    keepNext: opts.keepNext || undefined, // `false` would be written out as an explicit w:val
    widowControl: true,
    tabStops: [{ type: TabStopType.RIGHT, position: TEXT_W }],
    spacing: { before: opts.before ?? 0, after: 20 },
    children: [
      new TextRun({ text: left, bold: opts.bold, color: opts.bold ? TEXT : MUTED, size: 20 }),
      new TextRun({ text: "\t" + right, color: FAINT, size: 18 }),
    ],
  });
}
function para(text: string, color = TEXT, size = 20, keepNext = false): Paragraph {
  return new Paragraph({ keepNext: keepNext || undefined, widowControl: true, spacing: { after: 30 }, children: [new TextRun({ text, color, size })] });
}
/** `keepLast`: keep the last paragraph with the one after it (an entry's link line). */
function bullets(text?: string, keepLast = false): Paragraph[] {
  const lines = descLines(text);
  if (lines.length === 0) return [];
  if (lines.length === 1) return [para(lines[0], TEXT, 20, keepLast)];
  return lines.map((l, i) => new Paragraph({
    bullet: { level: 0 }, keepLines: true, keepNext: (keepLast && i === lines.length - 1) || undefined, widowControl: true,
    spacing: { after: 20 }, children: [new TextRun({ text: l, color: TEXT, size: 20 })],
  }));
}
function skillLine(label: string, value: string): Paragraph {
  return new Paragraph({ widowControl: true, spacing: { after: 20 }, children: [
    new TextRun({ text: `${label}: `, bold: true, color: TEXT, size: 20 }),
    new TextRun({ text: value, color: TEXT, size: 20 }),
  ] });
}

export function buildCvDocx(input: CvData, accent?: number | string): Document {
  const data = printableCv(input); // blank entries never reach the document
  const a = hexAccent(accent);
  const p = data.personalInfo;
  const c: Paragraph[] = [];

  // Header — name, role, contact (all in the BODY, never header/footer)
  if (p.name) c.push(new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: p.name, bold: true, color: TEXT, size: 44 })] }));
  if (data.summary.position) c.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: data.summary.position, color: MUTED, size: 24 })] }));
  // Two short lines, not one long one: readers that paginate the DOCX (and Word itself) wrapped
  // the single long line inside the LinkedIn URL, so parsers read a truncated slug (ATS lab).
  const contact1 = [p.email, p.phone, [p.cityState, p.country].filter(Boolean).join(", ")].filter(Boolean).join("   |   ");
  const links = [p.website, p.linkedin].filter(Boolean).map(displayUrl);
  // Long links each get their own line so no URL is ever wrapped mid-token.
  const linkLines = links.join("   |   ").length <= 60 ? [links.join("   |   ")].filter(Boolean) : links;
  const contactLines = [contact1, ...linkLines].filter(Boolean);
  contactLines.forEach((text, i) => c.push(new Paragraph({
    spacing: { after: i === contactLines.length - 1 ? 160 : 20 },
    children: [new TextRun({ text, color: MUTED, size: 18 })],
  })));

  // Summary
  if (data.summary.valueProposition) { c.push(heading("Summary", a)); c.push(para(data.summary.valueProposition)); }

  // Skills
  if (data.skills.length || data.instruments.length || data.softSkills.length || data.languages.length) {
    c.push(heading("Skills", a));
    if (data.skills.length) c.push(skillLine("Hard skills", data.skills.join(", ")));
    if (data.instruments.length) c.push(skillLine("Tools", data.instruments.join(", ")));
    if (data.softSkills.length) c.push(skillLine("Soft skills", data.softSkills.join(", ")));
    if (data.languages.length) c.push(skillLine("Languages", data.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(", ")));
  }

  // Work Experience
  if (data.work.length) {
    c.push(heading("Work Experience", a));
    data.work.forEach((w, i) => {
      const loc = [w.cityState, w.country].filter(Boolean).join(", ");
      const content = bullets(w.description);
      const sub = w.role ? w.company : ""; // no role: the company is the title
      const second = !!(sub || loc);
      c.push(split(w.role || w.company, dateRange(w.startDate, w.endDate, w.current), { bold: true, before: i === 0 ? 0 : 140, keepNext: second || content.length > 0 }));
      if (second) c.push(split(sub, loc, { keepNext: content.length > 0 }));
      c.push(...content);
    });
  }

  // Education
  if (data.education.length) {
    c.push(heading("Education", a));
    data.education.forEach((e, i) => {
      const right = [e.location, e.grade ? `Grade: ${e.grade}` : ""].filter(Boolean).join("   ·   ");
      const sub = e.degree ? e.institution : "";
      const second = !!(sub || right);
      // The minor gets its own line: on the title row it pushed the dates onto a second line in
      // readers that lay the page out narrower than A4 (PyMuPDF in the ATS lab).
      const minor = e.minor ? `Minor in ${e.minor}` : "";
      const more = !!(minor || e.additional);
      c.push(split(e.degree || e.institution || minor, dateRange(e.startDate, e.endDate), { bold: true, before: i === 0 ? 0 : 140, keepNext: second || more }));
      if (second) c.push(split(sub, right, { keepNext: more }));
      if (minor && (e.degree || e.institution)) c.push(para(minor, TEXT, 20, !!e.additional));
      if (e.additional) c.push(para(e.additional));
    });
  }

  // Awards / Certifications / Publications / Volunteering / Activities
  const simple: { key: keyof CvData; title: string }[] = [
    { key: "awards", title: "Awards" }, { key: "certifications", title: "Certifications" },
    { key: "publications", title: "Publications" }, { key: "volunteering", title: "Volunteering" },
    { key: "activities", title: "Activities" },
  ];
  for (const { key, title } of simple) {
    const items = data[key] as SimpleEntry[];
    if (!items.length) continue;
    c.push(heading(title, a));
    items.forEach((it, i) => {
      // volunteering / activities also have a role, a type, a place and an end date
      const right = [it.organisation || it.issuer || it.publisher, dateRange(it.date, it.endDate, it.ongoing)].filter(Boolean).join("   ·   ");
      const sub = [it.title ? it.role : "", it.activityType].filter(Boolean).join("   ·   ");
      const second = !!(sub || it.location);
      const content = bullets(it.description, !!it.link);
      const more = content.length > 0 || !!it.link;
      c.push(split(it.title || it.role || "", right, { bold: true, before: i === 0 ? 0 : 120, keepNext: second || more }));
      if (second) c.push(split(sub, it.location ?? "", { keepNext: more }));
      c.push(...content);
      if (it.link) c.push(para(it.link, FAINT, 18));
    });
  }

  // The person is the document's author (Word: File > Info); it said "ATS Hero" before.
  const name = p.name.trim();
  return new Document({
    creator: name,
    lastModifiedBy: name,
    title: name ? `${name} — CV` : "CV",
    subject: data.summary.position || undefined,
    styles: {
      default: {
        document: { run: { font: "Calibri", language: { value: "en-US" } } },
        // what heading() sets explicitly, so the style adds nothing of its own (no blue, no 16pt)
        heading1: {
          run: { font: "Calibri", bold: true, size: 22, color: TEXT },
          paragraph: { spacing: { before: 240, after: 80 }, keepNext: true },
        },
      },
    },
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 720, bottom: 720, left: MARGIN_X, right: MARGIN_X } } },
      children: c,
    }],
  });
}

export async function renderCvDocxBlob(data: CvData, accent?: number | string): Promise<Blob> {
  const { Packer } = await import("docx");
  return Packer.toBlob(buildCvDocx(data, accent));
}

export async function downloadCvDocx(data: CvData, accent?: number | string): Promise<void> {
  const blob = await renderCvDocxBlob(data, accent);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(data.personalInfo.name || "resume").trim().replace(/\s+/g, "_") || "resume"}.docx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
