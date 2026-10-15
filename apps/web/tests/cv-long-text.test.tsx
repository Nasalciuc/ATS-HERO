// Long text stays inside its column in every template: long words wrap where they can
// (lib/cv-print.ts breakLongWords), contacts shrink to one line (ContactBar), the right side
// of a title row wraps inside its half (SplitRow), and a wrapped list never starts a line with
// its separator (SEP). Before, a pasted URL ran past the margin, Modern's white sidebar text ran
// onto the white page, a long issuer squeezed the job title into one word per line, and skill
// lists wrapped as "· GCP · Terraform".
import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { TEMPLATES } from "@/components/cv/templates";
import { A4_WIDTH, LAYOUT, resolveTheme } from "@/components/cv/templates/theme";
import { hyphenationCallback, resetGlyphCache } from "@/components/cv/templates/fonts";
import { printableCv } from "@/lib/cv-print";
import { emptyCvData, type CvData } from "@/lib/types";
import { pdfItems, rowsOf, rowText, type PdfItem } from "./pdf-text";

const URL = "https://github.com/maximilian-konstantinopoulos/distributed-ledger-reconciliation-engine/blob/main/README.md";
const EMAIL = "maximilian.konstantinopoulos@example.com";

function longCv(): CvData {
  const d = emptyCvData();
  d.personalInfo = {
    ...d.personalInfo,
    name: "Maximilian-Alexander Konstantinopoulos-Vandersteen",
    email: EMAIL,
    phone: "+44 20 7946 0958",
    linkedin: "https://www.linkedin.com/in/maximilian-konstantinopoulos/",
    website: "maximilian-portfolio.example/projects/2026/case-studies/distributed-ledger",
    cityState: "Royal Leamington Spa, Warwickshire",
    country: "United Kingdom of Great Britain and Northern Ireland",
  };
  d.summary = { position: "Senior Principal Distributed Systems Engineer and Technical Lead", valueProposition: `Engineer; portfolio at ${URL}.` };
  d.skills = ["Continuous Integration and Continuous Deployment (CI/CD) pipeline engineering", "Event sourcing", "Kafka", "PostgreSQL", "Kubernetes", "Terraform", "AWS", "GCP", "System design", "Payments", "PCI-DSS", "Observability", "Incident management", "Go", "Kotlin", "Java", "TypeScript"];
  d.languages = [{ id: "l1", name: "Greek", level: "Professional working proficiency (ILR 3)" }];
  d.work = [{
    id: "w1",
    role: "Senior Principal Distributed Systems Engineer and Technical Lead for Real-Time Payments, Reconciliation and Fraud Detection",
    company: "Konstantinopoulos & Vandersteen International Clearing and Settlement Services Ltd",
    cityState: "Royal Leamington Spa, Warwickshire", country: "United Kingdom of Great Britain and Northern Ireland",
    startDate: "September 2021", endDate: "", current: true,
    description: `Documented the design in ${URL}\nCut settlement failures by 62% across eleven squads in three time zones.`,
  }];
  d.education = [{
    id: "e1", institution: "Universitatea de Medicină și Farmacie „Nicolae Testemițanu” din Republica Moldova",
    location: "Chișinău, Republic of Moldova", degree: "Doctor of Philosophy in Computational Biology", minor: "",
    startDate: "September 2010", endDate: "June 2016", grade: "10/10 (summa cum laude, top 1% of the graduating cohort)", additional: "",
  }];
  d.certifications = [{ id: "c1", title: "CISSP", description: "", date: "March 2024", issuer: "International Information System Security Certification Consortium (ISC)²" }];
  d.publications = [{ id: "p1", title: "Exactly-once settlement at scale", description: "", date: "2023", publisher: "ACM Queue", link: URL }];
  return d;
}

/** [left, right] of the text area (pt) for an item starting at x. */
function bounds(templateId: string, x: number): [number, number] {
  if (templateId === "modern") {
    const L = LAYOUT.modern;
    const sidebar = (A4_WIDTH * L.sidebarPct) / 100;
    return x < sidebar ? [L.sidebarPadX, sidebar - L.sidebarPadX] : [sidebar + L.mainPadX, A4_WIDTH - L.mainPadX];
  }
  const padX = LAYOUT[templateId as "classic" | "minimal"].padX;
  return [padX, A4_WIDTH - padX];
}

/** Right edge of what is drawn: trailing spaces are invisible (Inter's space is 0.28em). */
const inkRight = (it: PdfItem) => it.x + it.width - (it.str.length - it.str.trimEnd().length) * it.size * 0.2812;

describe("long text stays inside its column", () => {
  beforeAll(() => {
    Font.register({ family: "CvSans", src: path.join(process.cwd(), "public/fonts/Inter-Regular.ttf") });
    Font.register({ family: "CvSansBold", src: path.join(process.cwd(), "public/fonts/Inter-Bold.ttf") });
    Font.registerHyphenationCallback(hyphenationCallback);
  });

  for (const t of TEMPLATES) {
    it(`${t.id}: nothing runs past the margin or the sidebar, lists wrap after the separator`, async () => {
      const T = t.component;
      resetGlyphCache();
      const pages = await pdfItems(await renderToBuffer(<T data={printableCv(longCv())} theme={resolveTheme(t.id, 1)} />));
      const outside: string[] = [];
      for (const items of pages) {
        for (const it of items) {
          const [left, right] = bounds(t.id, it.x);
          if (it.x < left - 0.5 || inkRight(it) > right + 0.5) outside.push(`${it.str.slice(0, 50)} (${it.x.toFixed(1)}–${inkRight(it).toFixed(1)}, area ${left}–${right.toFixed(1)})`);
        }
      }
      expect(outside).toEqual([]);

      const rows = pages.flatMap((items) => rowsOf(items).map(rowText));
      expect(rows.filter((r) => r.startsWith("·"))).toEqual([]);
      const text = rows.join("\n");
      expect(text).not.toContain("​"); // break marks never reach the PDF
      expect(rows.some((r) => r.includes(EMAIL))).toBe(true); // a contact is never split
    }, 30_000);
  }
});
