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
  // Section-specific optional fields (Figma desktop wizard).
  organisation?: string; // Awards
  issuer?: string; // Certifications
  publisher?: string; // Publications
  link?: string; // Publications
  activityType?: string; // Relevant activities
  role?: string; // Relevant activities
  location?: string; // Relevant activities
  endDate?: string; // Relevant activities
  ongoing?: boolean; // Relevant activities
};

export type LanguageItem = { id: string; name: string; level: string };

export type CvData = {
  personalInfo: PersonalInfo;
  summary: Summary;
  work: WorkItem[];
  education: EducationItem[];
  skills: string[]; // Hard skills
  instruments: string[]; // Tools / instruments
  softSkills: string[];
  languages: LanguageItem[];
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

/** Scan flavours persisted in `scans.kind`. Mirrors the previous Convex scanKindValidator. */
export type ScanKind = "score" | "jobfit";
/** Saved = not sent yet (Tracker v2). The column is text, so a new status needs no migration. */
export type ApplicationStatus = "saved" | "applied" | "interview" | "offer" | "rejected";
export const APPLICATION_STATUSES: ApplicationStatus[] = ["saved", "applied", "interview", "offer", "rejected"];

/** Tracker v2 (TRACKER-V2-DESIGN.md §7). Where a job came from. */
export type ApplicationSource = "manual" | "job_fit" | "job_search" | "share" | "extension";
/** The system the job is applied through, from the posting's link. */
export type ApplyPlatform = "greenhouse" | "lever" | "ashby" | "workday" | "indeed" | "linkedin" | "other" | "unknown";
/** Who sent the application. */
export type AppliedVia = "self" | "agent" | "extension" | "copy_panel";
export type ArchiveReason = "no_response" | "withdrawn" | "closed" | "other";
/** One line of a job's history in `application_events`: only added, never rewritten. */
export type ApplicationEventKind =
  | "created" | "status_changed" | "archived" | "unarchived" | "cv_sent" | "follow_up_snoozed";
/** The boards a daily search reads (apps/ai /jobs/search through JobSpy). LinkedIn: its public job list only (rule 11). */
export type JobBoard = "indeed" | "linkedin";
/**
 * Where a job is in "Ready to send" (canvas page "Search & agent"):
 * waiting (queued) → preparing (the agent fills the form) → ready (the person checks it) → sending → sent.
 * handoff: the person continues on the site; refused: the agent doesn't go there; unconfirmed: Send
 * was pressed and the page didn't confirm; failed: the agent broke before anything was sent.
 */
export type QueueStatus =
  | "waiting" | "preparing" | "ready" | "sending" | "sent" | "unconfirmed" | "handoff" | "refused" | "failed";

/** Presentation preference stored on a CV. Canonical union lives with the templates. */
export type { TemplateId } from "../components/cv/templates";

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

/** Job Fit: the post's requirements, met or not (lib/job-fit.ts). */
export type { JobFitReport } from "./job-fit";

/** Each section's emoji (Figma "Icons_tabs"): the builder's stepper and the score page's rows. */
export const SECTION_EMOJI: Record<SectionKey, string> = {
  personalInfo: "🪪",
  education: "🎓",
  summary: "📋",
  work: "💼",
  skills: "💪",
  awards: "🏆",
  certifications: "📜",
  publications: "📰",
  volunteering: "🤝",
  activities: "🚀",
};

export const OPTIONAL_SECTIONS: { key: SectionKey; label: string; emoji: string }[] = [
  { key: "awards", label: "Awards", emoji: SECTION_EMOJI.awards },
  { key: "certifications", label: "Certifications", emoji: SECTION_EMOJI.certifications },
  { key: "publications", label: "Publications", emoji: SECTION_EMOJI.publications },
  { key: "volunteering", label: "Volunteering", emoji: SECTION_EMOJI.volunteering },
  { key: "activities", label: "Relevant activities", emoji: SECTION_EMOJI.activities },
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
    instruments: [],
    softSkills: [],
    languages: [],
    awards: [],
    certifications: [],
    publications: [],
    volunteering: [],
    activities: [],
  };
}

/**
 * The CV as text, laid out like the templates print it (headings, then each entry's role, company
 * and dates), so Job Fit reads the jobs' dates the way it does in an uploaded file: a builder CV's
 * "3+ years" is counted from its dates, not missed.
 */
export function cvToText(data: CvData): string {
  const range = (start?: string, end?: string, ongoing?: boolean) =>
    [start, ongoing ? "Present" : end].filter(Boolean).join(" – ");
  const line = (...xs: (string | undefined)[]) => xs.filter(Boolean).join(" · ");
  const out: string[] = [];
  // an empty string between entries keeps them apart; blank runs collapse at the end
  const section = (title: string, lines: (string | undefined)[]) => {
    if (lines.some(Boolean)) out.push("", title, ...lines.map((l) => l ?? ""));
  };
  const p = data.personalInfo;
  out.push(p.name, line(p.email, p.phone, p.linkedin, p.website, p.cityState, p.country));
  section("SUMMARY", [data.summary.position, data.summary.valueProposition]);
  section("SKILLS", [[...data.skills, ...data.instruments, ...data.softSkills].join(", ")]);
  section("EXPERIENCE", data.work.flatMap((w) => [
    w.role || w.company,
    line(w.role ? w.company : "", range(w.startDate, w.endDate, w.current), line(w.cityState, w.country)),
    w.description,
    "",
  ]));
  section("EDUCATION", data.education.flatMap((e) => [
    e.degree || e.institution,
    line(e.degree ? e.institution : "", range(e.startDate, e.endDate), e.location),
    e.minor,
    e.additional,
    "",
  ]));
  section("LANGUAGES", data.languages.map((l) => line(l.name, l.level)));
  const simple: [string, SimpleEntry[]][] = [
    ["AWARDS", data.awards], ["CERTIFICATIONS", data.certifications], ["PUBLICATIONS", data.publications],
    ["VOLUNTEERING", data.volunteering], ["ACTIVITIES", data.activities],
  ];
  for (const [title, list] of simple)
    section(title, list.flatMap((it) => [
      it.title,
      line(it.role, it.organisation || it.issuer || it.publisher, range(it.date, it.endDate, it.ongoing)),
      it.description,
      "",
    ]));
  return out.filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== "")).join("\n").trim();
}
