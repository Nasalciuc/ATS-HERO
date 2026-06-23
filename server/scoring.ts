import type {
  CvData,
  ScoreReport,
  SectionKey,
  SectionReport,
} from "./types.ts";

const SECTION_LABELS: Record<SectionKey, string> = {
  personalInfo: "Personal info",
  education: "Education",
  summary: "Professional summary",
  work: "Work experience",
  skills: "Skills",
  awards: "Awards",
  certifications: "Certifications",
  publications: "Publications",
  volunteering: "Volunteering",
  activities: "Relevant activities",
};

// Sections that always count toward the general score.
const CORE_SECTIONS: SectionKey[] = [
  "personalInfo",
  "summary",
  "work",
  "education",
  "skills",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMBER_RE = /\d/;
const ACTION_VERBS = [
  "led",
  "built",
  "designed",
  "developed",
  "analyzed",
  "managed",
  "created",
  "improved",
  "increased",
  "reduced",
  "launched",
  "delivered",
  "optimized",
  "implemented",
  "coordinated",
  "achieved",
];

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

function hasMetric(text: string): boolean {
  return /(\d+%|\$\d|\d+\s*(x|×)|\bby\s+\d+|\d{2,})/i.test(text);
}

function usesActionVerb(text: string): boolean {
  const lower = text.toLowerCase();
  return ACTION_VERBS.some((v) => lower.includes(v));
}

function scorePersonalInfo(data: CvData): SectionReport {
  const p = data.personalInfo;
  const critical: string[] = [];
  const suggestions: string[] = [];
  const goodPractices: string[] = [];
  let score = 0;

  if (p.name.trim()) {
    score += 25;
    goodPractices.push("Full name is present and clearly stated");
  } else critical.push("Missing full name");

  if (EMAIL_RE.test(p.email)) {
    score += 25;
    goodPractices.push("Reachable, well-formatted email address");
  } else critical.push("Missing or invalid email address");

  if (p.phone.trim()) score += 15;
  else suggestions.push("Add a phone number where you're reachable");

  if (p.linkedin.trim()) {
    score += 15;
    goodPractices.push("LinkedIn profile included");
  } else suggestions.push("Add your LinkedIn profile — recruiters verify it");

  if (p.cityState.trim() || p.country.trim()) score += 10;
  else suggestions.push("Add your location (city / country)");

  if (p.website.trim()) score += 10;
  else suggestions.push("Add a portfolio or personal website if relevant");

  return finalize("personalInfo", score, critical, suggestions, goodPractices);
}

function scoreSummary(data: CvData): SectionReport {
  const s = data.summary;
  const critical: string[] = [];
  const suggestions: string[] = [];
  const goodPractices: string[] = [];
  let score = 0;

  if (s.position.trim()) {
    score += 25;
    goodPractices.push("Target position is specified");
  } else critical.push("Missing target position");

  const len = s.valueProposition.trim().length;
  if (len === 0) {
    critical.push("Professional summary is empty");
  } else if (len < 150) {
    score += 30;
    suggestions.push("Expand your summary to 2–4 impactful sentences");
  } else if (len > 600) {
    score += 45;
    suggestions.push("Tighten your summary — keep it under ~600 characters");
  } else {
    score += 55;
    goodPractices.push("Summary length is well balanced");
  }

  if (hasMetric(s.valueProposition)) {
    score += 20;
    goodPractices.push("Summary references measurable achievements");
  } else suggestions.push("Quantify your value (numbers, %, scale)");

  return finalize("summary", score, critical, suggestions, goodPractices);
}

function scoreWork(data: CvData): SectionReport {
  const items = data.work;
  const critical: string[] = [];
  const suggestions: string[] = [];
  const goodPractices: string[] = [];

  if (items.length === 0) {
    return finalize(
      "work",
      0,
      ["No work experience added"],
      ["Add at least one role with a results-focused description"],
      []
    );
  }

  let total = 0;
  let withMetric = 0;
  let withVerb = 0;
  let missingDesc = 0;

  for (const w of items) {
    let s = 0;
    if (w.role.trim()) s += 25;
    if (w.company.trim()) s += 20;
    if (w.startDate.trim()) s += 10;
    const dlen = w.description.trim().length;
    if (dlen === 0) missingDesc++;
    else if (dlen >= 60) s += 25;
    else s += 12;
    if (hasMetric(w.description)) {
      s += 12;
      withMetric++;
    }
    if (usesActionVerb(w.description)) {
      s += 8;
      withVerb++;
    }
    total += clamp(s);
  }

  const score = total / items.length;

  if (missingDesc > 0)
    critical.push("Missing or unclear role descriptions");
  if (withMetric < items.length)
    critical.push("Lack of measurable impact or results");
  if (withVerb < items.length)
    suggestions.push("Start bullets with strong action verbs");
  suggestions.push("Add keywords relevant to your target role");
  suggestions.push("Keep descriptions concise (30–120 characters per bullet)");
  if (withMetric > 0)
    goodPractices.push("Some achievements are quantified with metrics");
  goodPractices.push("Clear role and organization information");
  goodPractices.push("Consistent structure across entries");

  return finalize("work", score, critical, suggestions, goodPractices);
}

function scoreEducation(data: CvData): SectionReport {
  const items = data.education;
  const critical: string[] = [];
  const suggestions: string[] = [];
  const goodPractices: string[] = [];

  if (items.length === 0) {
    return finalize(
      "education",
      0,
      ["No education entries added"],
      ["Add your degree, institution and dates"],
      []
    );
  }

  let total = 0;
  for (const e of items) {
    let s = 0;
    if (e.institution.trim()) s += 35;
    if (e.degree.trim()) s += 35;
    if (e.startDate.trim() || e.endDate.trim()) s += 20;
    if (e.grade.trim() || e.additional.trim()) s += 10;
    total += clamp(s);
  }
  const score = total / items.length;

  if (score >= 80) goodPractices.push("Degree, institution and dates are clear");
  else suggestions.push("Complete institution, degree and dates");
  suggestions.push("List relevant coursework or honors if recent graduate");

  return finalize("education", score, critical, suggestions, goodPractices);
}

function scoreSkills(data: CvData): SectionReport {
  const hard = (data.skills ?? []).filter((s) => s.trim());
  const instruments = (data.instruments ?? []).filter((s) => s.trim());
  const soft = (data.softSkills ?? []).filter((s) => s.trim());
  const languages = (data.languages ?? []).filter((l) => l.name?.trim());
  const items = [...hard, ...instruments, ...soft];
  const critical: string[] = [];
  const suggestions: string[] = [];
  const goodPractices: string[] = [];
  let score = 0;

  if (items.length === 0) {
    critical.push("No skills listed");
  } else if (items.length < 5) {
    score = 50;
    suggestions.push("Add more relevant skills (aim for 6–12)");
  } else if (items.length > 25) {
    score = 70;
    suggestions.push("Trim to the most relevant skills for your target role");
  } else {
    score = 90;
    goodPractices.push("Healthy number of relevant skills");
  }

  if (hard.length > 0 && instruments.length > 0)
    goodPractices.push("Hard skills and tools are clearly separated");
  else if (items.length > 0)
    suggestions.push("Group tools/instruments separately from core hard skills");

  if (soft.length > 0) goodPractices.push("Soft skills add a well-rounded profile");
  else suggestions.push("Add a few soft skills (e.g. collaboration, communication)");

  if (languages.length > 0) goodPractices.push("Languages listed with proficiency level");
  else suggestions.push("Add languages and proficiency levels if relevant");

  return finalize("skills", score, critical, suggestions, goodPractices);
}

function scoreSimpleSection(
  key: SectionKey,
  items: { title: string; description: string }[]
): SectionReport {
  const critical: string[] = [];
  const suggestions: string[] = [];
  const goodPractices: string[] = [];

  if (items.length === 0) {
    return finalize(
      key,
      0,
      [],
      [`Add ${SECTION_LABELS[key].toLowerCase()} to strengthen your profile`],
      []
    );
  }

  let total = 0;
  for (const it of items) {
    let s = 0;
    if (it.title.trim()) s += 60;
    if (it.description.trim()) s += 40;
    total += clamp(s);
  }
  const score = total / items.length;
  if (score >= 80)
    goodPractices.push(`${SECTION_LABELS[key]} entries are well described`);
  else suggestions.push(`Add short descriptions to each entry`);

  return finalize(key, score, critical, suggestions, goodPractices);
}

function finalize(
  key: SectionKey,
  rawScore: number,
  critical: string[],
  suggestions: string[],
  goodPractices: string[]
): SectionReport {
  const score = clamp(rawScore);
  return {
    key,
    label: SECTION_LABELS[key],
    score,
    entryScore: score,
    critical,
    suggestions,
    goodPractices,
  };
}

export function scoreCv(data: CvData): ScoreReport {
  const sections: SectionReport[] = [
    scorePersonalInfo(data),
    scoreEducation(data),
    scoreSummary(data),
    scoreWork(data),
    scoreSkills(data),
    scoreSimpleSection("awards", data.awards),
    scoreSimpleSection("certifications", data.certifications),
    scoreSimpleSection("publications", data.publications),
    scoreSimpleSection("volunteering", data.volunteering),
    scoreSimpleSection("activities", data.activities),
  ];

  // General score weights core sections heavily; optional sections add a small bonus.
  const core = sections.filter((s) => CORE_SECTIONS.includes(s.key));
  const optional = sections.filter((s) => !CORE_SECTIONS.includes(s.key));
  const coreAvg =
    core.reduce((sum, s) => sum + s.score, 0) / (core.length || 1);
  const optionalFilled = optional.filter((s) => s.score > 0);
  const optionalBonus =
    optionalFilled.length > 0
      ? (optionalFilled.reduce((sum, s) => sum + s.score, 0) /
          optionalFilled.length) *
        0.12
      : 0;

  const generalScore = clamp(coreAvg * 0.9 + optionalBonus);

  return {
    generalScore,
    message: messageForScore(generalScore),
    sections,
  };
}

function messageForScore(score: number): string {
  if (score >= 85)
    return "Your resume is in great shape and ready to pass ATS screening.";
  if (score >= 70)
    return "Your resume is solid, with a few opportunities to stand out more.";
  if (score >= 50)
    return "Your resume has a few critical issues, along with suggestions to help improve your chances of getting hired.";
  return "Your resume needs significant work to pass ATS screening — focus on the critical mistakes first.";
}

/** Score raw CV text (Function 2 — Improve flow, when no structured data exists). */
export function scoreRawText(text: string): ScoreReport {
  const lower = text.toLowerCase();
  const length = text.trim().length;
  const sections: SectionReport[] = [];

  const hasEmail = EMAIL_RE.test(text);
  const hasPhone = /(\+?\d[\d\s\-()]{7,})/.test(text);
  const hasLinkedin = lower.includes("linkedin");
  const contactScore =
    (hasEmail ? 45 : 0) + (hasPhone ? 30 : 0) + (hasLinkedin ? 25 : 0);
  sections.push(
    finalize(
      "personalInfo",
      contactScore,
      hasEmail ? [] : ["No email address detected"],
      hasPhone ? [] : ["Add a phone number"],
      hasEmail ? ["Contact details detected"] : []
    )
  );

  const keywords = ["experience", "education", "skills", "summary"];
  for (const kw of keywords) {
    const present = lower.includes(kw);
    const key = (kw === "experience"
      ? "work"
      : kw === "summary"
      ? "summary"
      : kw) as SectionKey;
    sections.push(
      finalize(
        key,
        present ? 75 : 20,
        present ? [] : [`No clear "${kw}" section detected`],
        present ? [] : [`Add a dedicated ${kw} section`],
        present ? [`"${kw}" section detected`] : []
      )
    );
  }

  const metricBonus = hasMetric(text) ? 10 : 0;
  const lengthScore = length > 1500 ? 80 : length > 600 ? 65 : 40;
  const generalScore = clamp(
    (contactScore * 0.3 + lengthScore * 0.5) + metricBonus
  );

  return {
    generalScore,
    message: messageForScore(generalScore),
    sections,
  };
}
