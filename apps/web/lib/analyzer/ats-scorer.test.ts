import { describe, it, expect } from "vitest";
import { scoreCv, scoreRawText } from "./ats-scorer";
import type { CvData, ScoreReport, SectionKey, SectionReport } from "../types";

/* --------------------------- test helpers --------------------------- */

function emptyData(): CvData {
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

/** Deep-ish merge so a test only specifies the fields it cares about. */
function makeData(patch: Partial<CvData> = {}): CvData {
  const base = emptyData();
  return {
    ...base,
    ...patch,
    personalInfo: { ...base.personalInfo, ...(patch.personalInfo ?? {}) },
    summary: { ...base.summary, ...(patch.summary ?? {}) },
  };
}

function section(report: ScoreReport, key: SectionKey): SectionReport {
  const s = report.sections.find((x) => x.key === key);
  if (!s) throw new Error(`Section ${key} not found in report`);
  return s;
}

const FILLED_WORK = {
  id: "w1",
  role: "Investment Analyst",
  company: "Allianz Global Investors",
  description:
    "Led financial modeling and valuation work, increased portfolio returns by 30% across 12 mandates.",
  startDate: "October 2022",
  endDate: "September 2025",
  current: false,
  country: "Germany",
  cityState: "Berlin",
};

const FILLED_EDU = {
  id: "e1",
  institution: "Technical University of Munich",
  location: "Munich, Germany",
  degree: "Bachelor of Science",
  minor: "Business Administration",
  startDate: "October 2019",
  endDate: "September 2022",
  grade: "1.3",
  additional: "Graduated with honors",
};

/* ------------------------------ shape ------------------------------ */

describe("scoreCv — report shape", () => {
  it("always returns the 10 expected sections in a stable order", () => {
    const report = scoreCv(emptyData());
    expect(report.sections.map((s) => s.key)).toEqual([
      "personalInfo",
      "education",
      "summary",
      "work",
      "skills",
      "awards",
      "certifications",
      "publications",
      "volunteering",
      "activities",
    ]);
  });

  it("every section score stays within 0..100", () => {
    const report = scoreCv(makeData({ work: [FILLED_WORK], education: [FILLED_EDU] }));
    for (const s of report.sections) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
    expect(report.generalScore).toBeGreaterThanOrEqual(0);
    expect(report.generalScore).toBeLessThanOrEqual(100);
  });

  it("mirrors score into entryScore", () => {
    const report = scoreCv(makeData({ work: [FILLED_WORK] }));
    for (const s of report.sections) expect(s.entryScore).toBe(s.score);
  });
});

/* --------------------------- personal info --------------------------- */

describe("personalInfo", () => {
  it("empty → 0 with critical for name and email", () => {
    const s = section(scoreCv(emptyData()), "personalInfo");
    expect(s.score).toBe(0);
    expect(s.critical).toContain("Missing full name");
    expect(s.critical).toContain("Missing or invalid email address");
  });

  it("name + valid email = 50", () => {
    const s = section(
      scoreCv(makeData({ personalInfo: { ...emptyData().personalInfo, name: "David Smith", email: "david@x.com" } })),
      "personalInfo"
    );
    expect(s.score).toBe(50);
    expect(s.critical).toHaveLength(0);
  });

  it("rejects a malformed email as critical", () => {
    const s = section(
      scoreCv(makeData({ personalInfo: { ...emptyData().personalInfo, name: "X", email: "not-an-email" } })),
      "personalInfo"
    );
    expect(s.critical).toContain("Missing or invalid email address");
  });

  it("fully populated = 100", () => {
    const s = section(
      scoreCv(
        makeData({
          personalInfo: {
            name: "David Smith",
            email: "david@x.com",
            phone: "+49 123",
            photo: "",
            linkedin: "https://linkedin.com/in/x",
            website: "https://x.com",
            country: "Germany",
            cityState: "Berlin",
          },
        })
      ),
      "personalInfo"
    );
    expect(s.score).toBe(100);
  });
});

/* ------------------------------ summary ------------------------------ */

describe("summary", () => {
  it("empty → critical for missing position and empty summary", () => {
    const s = section(scoreCv(emptyData()), "summary");
    expect(s.critical).toContain("Missing target position");
    expect(s.critical).toContain("Professional summary is empty");
  });

  it("position + balanced length + metric = 100", () => {
    const balanced =
      "Investment Analyst with 4 years of experience in financial modeling and valuation. " +
      "Increased returns by 30% and reduced reporting time by 50% across multiple mandates and teams.";
    expect(balanced.length).toBeGreaterThanOrEqual(150);
    expect(balanced.length).toBeLessThanOrEqual(600);
    const s = section(
      scoreCv(makeData({ summary: { position: "Investment Analyst", valueProposition: balanced } })),
      "summary"
    );
    expect(s.score).toBe(100);
    expect(s.goodPractices).toContain("Summary length is well balanced");
  });

  it("a short (<150) summary scores lower and suggests expanding", () => {
    const s = section(
      scoreCv(makeData({ summary: { position: "Analyst", valueProposition: "Short summary." } })),
      "summary"
    );
    // 25 (position) + 30 (short) + 0 (no metric) = 55
    expect(s.score).toBe(55);
    expect(s.suggestions).toContain("Expand your summary to 2–4 impactful sentences");
  });
});

/* ------------------------------- work ------------------------------- */

describe("work", () => {
  it("empty → 0 with critical", () => {
    const s = section(scoreCv(emptyData()), "work");
    expect(s.score).toBe(0);
    expect(s.critical).toContain("No work experience added");
  });

  it("a strong entry (role+company+dates+long desc+metric+verb) reaches 100", () => {
    const s = section(scoreCv(makeData({ work: [FILLED_WORK] })), "work");
    // 25 + 20 + 10 + 25 + 12 + 8 = 100
    expect(s.score).toBe(100);
  });

  it("flags missing metrics when no entry has measurable impact", () => {
    const noMetric = { ...FILLED_WORK, description: "Worked on financial reports and supported the team." };
    const s = section(scoreCv(makeData({ work: [noMetric] })), "work");
    expect(s.critical).toContain("Lack of measurable impact or results");
  });

  it("averages the score across multiple entries", () => {
    const weak = {
      ...FILLED_WORK,
      id: "w2",
      description: "", // missing description
      startDate: "",
    };
    const s = section(scoreCv(makeData({ work: [FILLED_WORK, weak] })), "work");
    expect(s.score).toBeLessThan(100);
    expect(s.score).toBeGreaterThan(0);
  });
});

/* ----------------------------- education ----------------------------- */

describe("education", () => {
  it("empty → 0 with critical", () => {
    const s = section(scoreCv(emptyData()), "education");
    expect(s.score).toBe(0);
    expect(s.critical).toContain("No education entries added");
  });

  it("institution + degree + dates + extra = 100", () => {
    const s = section(scoreCv(makeData({ education: [FILLED_EDU] })), "education");
    expect(s.score).toBe(100);
  });
});

/* ------------------------------ skills ------------------------------ */

describe("skills (count buckets: 0→crit, 1-4→50, 5-25→90, 26+→70)", () => {
  it("0 skills → 0 with critical", () => {
    const s = section(scoreCv(emptyData()), "skills");
    expect(s.score).toBe(0);
    expect(s.critical).toContain("No skills listed");
  });

  it("4 skills → 50", () => {
    const s = section(scoreCv(makeData({ skills: ["a", "b", "c", "d"] })), "skills");
    expect(s.score).toBe(50);
  });

  it("exactly 5 skills → 90 (boundary)", () => {
    const s = section(scoreCv(makeData({ skills: ["a", "b", "c", "d", "e"] })), "skills");
    expect(s.score).toBe(90);
  });

  it("25 skills → 90 (upper boundary)", () => {
    const many = Array.from({ length: 25 }, (_, i) => `s${i}`);
    const s = section(scoreCv(makeData({ skills: many })), "skills");
    expect(s.score).toBe(90);
  });

  it("26 skills → 70 (over the cap)", () => {
    const many = Array.from({ length: 26 }, (_, i) => `s${i}`);
    const s = section(scoreCv(makeData({ skills: many })), "skills");
    expect(s.score).toBe(70);
  });

  it("counts hard + instruments + soft together toward the bucket", () => {
    // 2 hard + 2 instruments + 2 soft = 6 → lands in the 5-25 bucket → 90
    const s = section(
      scoreCv(makeData({ skills: ["a", "b"], instruments: ["c", "d"], softSkills: ["e", "f"] })),
      "skills"
    );
    expect(s.score).toBe(90);
  });
});

/* ------------------------- optional sections ------------------------- */

describe("optional simple sections", () => {
  it("empty awards → 0 with a suggestion (no critical)", () => {
    const s = section(scoreCv(emptyData()), "awards");
    expect(s.score).toBe(0);
    expect(s.critical).toHaveLength(0);
    expect(s.suggestions.length).toBeGreaterThan(0);
  });

  it("title + description per entry = 100", () => {
    const s = section(
      scoreCv(makeData({ awards: [{ id: "a1", title: "Dean's List", description: "Top 5%", date: "2022" }] })),
      "awards"
    );
    expect(s.score).toBe(100);
  });

  it("title only (no description) = 60", () => {
    const s = section(
      scoreCv(makeData({ certifications: [{ id: "c1", title: "AWS SAA", description: "", date: "" }] })),
      "certifications"
    );
    expect(s.score).toBe(60);
  });
});

/* -------------------------- general score -------------------------- */

describe("generalScore formula", () => {
  it("empty CV yields a low score and the 'needs work' message", () => {
    const r = scoreCv(emptyData());
    expect(r.generalScore).toBeLessThan(50);
    expect(r.message).toMatch(/needs significant work/i);
  });

  it("FINDING: skills caps at 90, so a perfect core-only CV maxes at 88.2 (not 90)", () => {
    const perfectCore = makeData({
      personalInfo: {
        name: "David Smith",
        email: "david@x.com",
        phone: "+49 123",
        photo: "",
        linkedin: "https://linkedin.com/in/x",
        website: "https://x.com",
        country: "Germany",
        cityState: "Berlin",
      },
      summary: {
        position: "Investment Analyst",
        valueProposition:
          "Investment Analyst with 4 years of experience in financial modeling and valuation. " +
          "Increased returns by 30% and reduced reporting time by 50% across multiple mandates.",
      },
      work: [FILLED_WORK],
      education: [FILLED_EDU],
      skills: ["Excel", "Python", "Valuation", "Modeling", "SQL", "Bloomberg"],
    });
    const r = scoreCv(perfectCore);
    // skills section is hard-capped at 90, so coreAvg = (100+100+100+100+90)/5 = 98.
    // generalScore = 98 * 0.9 = 88.2 (no optional bonus). The realistic max without
    // optional sections is therefore 88.2, NOT 90.
    expect(r.generalScore).toBe(88.2);
  });

  it("adding a filled optional section pushes a perfect CV to 100 (clamped)", () => {
    const perfectAll = makeData({
      personalInfo: {
        name: "David Smith",
        email: "david@x.com",
        phone: "+49 123",
        photo: "",
        linkedin: "https://linkedin.com/in/x",
        website: "https://x.com",
        country: "Germany",
        cityState: "Berlin",
      },
      summary: {
        position: "Investment Analyst",
        valueProposition:
          "Investment Analyst with 4 years of experience in financial modeling and valuation. " +
          "Increased returns by 30% and reduced reporting time by 50% across multiple mandates.",
      },
      work: [FILLED_WORK],
      education: [FILLED_EDU],
      skills: ["Excel", "Python", "Valuation", "Modeling", "SQL", "Bloomberg"],
      awards: [{ id: "a1", title: "Dean's List", description: "Top 5%", date: "2022" }],
    });
    const r = scoreCv(perfectAll);
    // 90 + (100 * 0.12) = 102 → clamped to 100
    expect(r.generalScore).toBe(100);
    expect(r.message).toMatch(/great shape/i);
  });
});

/* --------------------------- scoreRawText --------------------------- */

describe("scoreRawText (Improve flow, plain text)", () => {
  it("detects contact channels", () => {
    const text = "John Doe john@x.com +1 555 123 4567 linkedin.com/in/john";
    const r = scoreRawText(text);
    const pi = section(r, "personalInfo");
    expect(pi.goodPractices).toContain("Contact details detected");
  });

  it("flags a missing email", () => {
    const r = scoreRawText("Just some text with a phone +1 555 123 4567");
    const pi = section(r, "personalInfo");
    expect(pi.critical).toContain("No email address detected");
  });

  it("maps the 'experience' keyword onto the work section", () => {
    const r = scoreRawText("Professional experience: built systems. Education: BSc. Skills: x. Summary: y.");
    const work = section(r, "work");
    expect(work.goodPractices.some((g) => /experience/i.test(g))).toBe(true);
  });

  it("rewards longer documents with a higher general score", () => {
    const short = scoreRawText("john@x.com experience education skills summary");
    const long = scoreRawText(
      "john@x.com +1 555 1234567 linkedin " +
        "experience education skills summary ".repeat(80) +
        " improved revenue by 40%"
    );
    expect(long.generalScore).toBeGreaterThan(short.generalScore);
  });
});

/* ----------------- metric detection edge cases (findings) ----------------- */

describe("hasMetric — edge cases worth knowing", () => {
  const withDesc = (description: string) =>
    section(scoreCv(makeData({ work: [{ ...FILLED_WORK, description }] })), "work");

  it("recognizes percentages, money, multipliers and 2+ digit numbers", () => {
    expect(withDesc("Led work and increased revenue by 30%").goodPractices.join(" ")).toMatch(/quantified/i);
    expect(withDesc("Led work generating $5 in value").goodPractices.join(" ")).toMatch(/quantified/i);
    expect(withDesc("Led work achieving 10x growth").goodPractices.join(" ")).toMatch(/quantified/i);
    expect(withDesc("Led work managing 50 people").goodPractices.join(" ")).toMatch(/quantified/i);
  });

  it("FINDING: a single-digit count (e.g. 'team of 3') is NOT treated as a metric", () => {
    const s = withDesc("Led a team of 3 engineers");
    // single digit, no %/$/x → hasMetric false → flagged as lacking measurable impact
    expect(s.critical).toContain("Lack of measurable impact or results");
  });
});
