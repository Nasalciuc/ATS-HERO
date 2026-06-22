import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CvData, DbShape, EducationItem, SimpleEntry, WorkItem } from "./types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function ensure(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const empty: DbShape = { users: [], cvs: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(empty, null, 2));
  }
}

export function readDb(): DbShape {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as DbShape;
  } catch {
    return { users: [], cvs: [] };
  }
}

export function writeDb(db: DbShape): void {
  ensure();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function emptyCvData(): CvData {
  return {
    personalInfo: {
      name: "",
      email: "",
      phone: "",
      photo: "",
      linkedin: "",
      website: "",
      country: "",
      cityState: "",
    },
    summary: { position: "", valueProposition: "" },
    work: [],
    education: [],
    skills: [],
    awards: [],
    certifications: [],
    publications: [],
    volunteering: [],
    activities: [],
  };
}

const EMPTY_WORK: Omit<WorkItem, "id"> = {
  role: "",
  company: "",
  description: "",
  startDate: "",
  endDate: "",
  current: false,
  country: "",
  cityState: "",
};

const EMPTY_EDUCATION: Omit<EducationItem, "id"> = {
  institution: "",
  location: "",
  degree: "",
  minor: "",
  startDate: "",
  endDate: "",
  grade: "",
  additional: "",
};

const EMPTY_SIMPLE: Omit<SimpleEntry, "id"> = {
  title: "",
  description: "",
  date: "",
};

function normalizeSimpleEntries(items: SimpleEntry[] | undefined): SimpleEntry[] {
  return (items ?? []).map((item) => ({ ...EMPTY_SIMPLE, ...item, id: item.id ?? "" }));
}

/** Ensures partial CV payloads from API clients have all fields scoring expects. */
export function normalizeCvData(input: Partial<CvData> = {}): CvData {
  const base = emptyCvData();
  return {
    ...base,
    ...input,
    personalInfo: { ...base.personalInfo, ...(input.personalInfo ?? {}) },
    summary: { ...base.summary, ...(input.summary ?? {}) },
    work: (input.work ?? base.work).map((item) => ({
      ...EMPTY_WORK,
      ...item,
      id: item.id ?? "",
    })),
    education: (input.education ?? base.education).map((item) => ({
      ...EMPTY_EDUCATION,
      ...item,
      id: item.id ?? "",
    })),
    skills: input.skills ?? base.skills,
    awards: normalizeSimpleEntries(input.awards),
    certifications: normalizeSimpleEntries(input.certifications),
    publications: normalizeSimpleEntries(input.publications),
    volunteering: normalizeSimpleEntries(input.volunteering),
    activities: normalizeSimpleEntries(input.activities),
  };
}

export function mergeCvData(existing: CvData, patch: Partial<CvData>): CvData {
  return normalizeCvData({
    ...existing,
    ...patch,
    personalInfo: { ...existing.personalInfo, ...(patch.personalInfo ?? {}) },
    summary: { ...existing.summary, ...(patch.summary ?? {}) },
    work: patch.work ?? existing.work,
    education: patch.education ?? existing.education,
    skills: patch.skills ?? existing.skills,
    awards: patch.awards ?? existing.awards,
    certifications: patch.certifications ?? existing.certifications,
    publications: patch.publications ?? existing.publications,
    volunteering: patch.volunteering ?? existing.volunteering,
    activities: patch.activities ?? existing.activities,
  });
}
