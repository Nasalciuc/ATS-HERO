export type PersonalInfo = {
  name: string;
  email: string;
  phone: string;
  photo?: string;
  linkedin: string;
  website: string;
  country: string;
  cityState: string;
};

export type Summary = {
  position: string;
  valueProposition: string;
};

export type WorkItem = {
  id: string;
  role: string;
  company: string;
  description: string;
  startDate: string;
  endDate: string;
  current: boolean;
  country: string;
  cityState: string;
};

export type EducationItem = {
  id: string;
  institution: string;
  location: string;
  degree: string;
  minor: string;
  startDate: string;
  endDate: string;
  grade: string;
  additional: string;
};

export type SimpleEntry = {
  id: string;
  title: string;
  description: string;
  date: string;
};

export type CvData = {
  personalInfo: PersonalInfo;
  summary: Summary;
  work: WorkItem[];
  education: EducationItem[];
  skills: string[];
  awards: SimpleEntry[];
  certifications: SimpleEntry[];
  publications: SimpleEntry[];
  volunteering: SimpleEntry[];
  activities: SimpleEntry[];
};

export type Cv = {
  id: string;
  ownerId: string | null;
  title: string;
  data: CvData;
  createdAt: string;
  updatedAt: string;
};

export type User = { id: string; email: string };

export type SectionKey =
  | "personalInfo"
  | "education"
  | "summary"
  | "work"
  | "skills"
  | "awards"
  | "certifications"
  | "publications"
  | "volunteering"
  | "activities";

export type SectionReport = {
  key: SectionKey;
  label: string;
  score: number;
  entryScore: number;
  critical: string[];
  suggestions: string[];
  goodPractices: string[];
};

export type ScoreReport = {
  generalScore: number;
  message: string;
  sections: SectionReport[];
};

export type JobFitReport = {
  matchScore: number;
  matched: string[];
  missing: string[];
  message: string;
};

export const OPTIONAL_SECTIONS: { key: SectionKey; label: string; emoji: string }[] = [
  { key: "awards", label: "Awards", emoji: "🏆" },
  { key: "certifications", label: "Certifications", emoji: "📜" },
  { key: "publications", label: "Publications", emoji: "📚" },
  { key: "volunteering", label: "Volunteering", emoji: "🤝" },
  { key: "activities", label: "Relevant activities", emoji: "🚀" },
];

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

/** Flatten CV data into plain text for scoring / job-fit. */
export function cvToText(data: CvData): string {
  const parts: string[] = [];
  const p = data.personalInfo;
  parts.push(p.name, p.email, p.phone, p.linkedin, p.website, p.country, p.cityState);
  parts.push(data.summary.position, data.summary.valueProposition);
  for (const w of data.work)
    parts.push(w.role, w.company, w.description, w.country, w.cityState);
  for (const e of data.education)
    parts.push(e.institution, e.degree, e.minor, e.location, e.additional);
  parts.push(...data.skills);
  for (const list of [data.awards, data.certifications, data.publications, data.volunteering, data.activities])
    for (const it of list) parts.push(it.title, it.description);
  return parts.filter(Boolean).join("\n");
}
