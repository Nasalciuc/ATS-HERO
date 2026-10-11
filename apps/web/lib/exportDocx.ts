// DOCX export — ATS-first. Built programmatically from CvData with the `docx` library,
// client-side (mirrors downloadCvPdf). Deliberately a SINGLE clean document, NOT a clone of
// the visual templates: the DOCX's job is reliable parsing on strict/legacy portals, so it
// is single-column, uses standard headings ("Work Experience", "Education", "Skills"), keeps
// contact in the BODY (not header/footer), uses real bullets and tab-stop alignment, and has
// no tables or text boxes. Accent shows only on heading color (brand without hurting parsing).
import {
  Document, Paragraph, TextRun, TabStopType, TabStopPosition, BorderStyle,
} from "docx";
import type { CvData, SimpleEntry } from "@/lib/types";
import { displayUrl, printableCv } from "@/lib/cv-print";

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

function heading(text: string, accent: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 80 },
    border: { bottom: { color: accent, style: BorderStyle.SINGLE, size: 8, space: 2 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, color: accent, size: 22 })],
  });
}
function split(left: string, right: string, opts: { bold?: boolean; before?: number } = {}): Paragraph {
  return new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: opts.before ?? 0, after: 20 },
    children: [
      new TextRun({ text: left, bold: opts.bold, color: opts.bold ? TEXT : MUTED, size: 20 }),
      new TextRun({ text: "\t" + right, color: FAINT, size: 18 }),
    ],
  });
}
function para(text: string, color = TEXT, size = 20): Paragraph {
  return new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text, color, size })] });
}
function bullets(text?: string): Paragraph[] {
  const lines = descLines(text);
  if (lines.length === 0) return [];
  if (lines.length === 1) return [para(lines[0])];
  return lines.map((l) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 20 }, children: [new TextRun({ text: l, color: TEXT, size: 20 })] }));
}
function skillLine(label: string, value: string): Paragraph {
  return new Paragraph({ spacing: { after: 20 }, children: [
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
  c.push(new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: p.name || "Your Name", bold: true, color: TEXT, size: 44 })] }));
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
      c.push(split(w.role || "—", dateRange(w.startDate, w.endDate, w.current), { bold: true, before: i === 0 ? 0 : 140 }));
      const loc = [w.cityState, w.country].filter(Boolean).join(", ");
      if (w.company || loc) c.push(split(w.company, loc));
      c.push(...bullets(w.description));
    });
  }

  // Education
  if (data.education.length) {
    c.push(heading("Education", a));
    data.education.forEach((e, i) => {
      c.push(split(e.degree || e.institution || "—", dateRange(e.startDate, e.endDate), { bold: true, before: i === 0 ? 0 : 140 }));
      const right = [e.location, e.grade ? `Grade: ${e.grade}` : ""].filter(Boolean).join("   ·   ");
      if ((e.degree && e.institution) || right) c.push(split(e.degree ? e.institution : "", right));
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
      const right = [it.organisation || it.issuer || it.publisher, it.date].filter(Boolean).join("   ·   ");
      c.push(split(it.title || it.role || "—", right, { bold: true, before: i === 0 ? 0 : 120 }));
      c.push(...bullets(it.description));
      if (it.link) c.push(para(it.link, FAINT, 18));
    });
  }

  return new Document({
    creator: "ATS Hero",
    title: `${p.name || "Resume"} — CV`,
    styles: { default: { document: { run: { font: "Calibri" } } } },
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
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
