// Job Fit (lib/job-fit.ts): the post's requirements, met or not, with HiredScore's grade
// definitions as the summary and no percentage. Synthetic people and posts only (AGENTS.md rule 11).
// Design: ATS-REAL-VS-NOI.md §5.4 (claude.ai Project "App Builder").
import { describe, it, expect } from "vitest";
import { findSkills, jobFit, requirementsOf, yearsAsked } from "@/lib/job-fit";

const TODAY = new Date(2026, 10, 1);

const POST = `Data Analyst (Chisinau, hybrid)
About us: we are a fast-growing fintech.
Requirements:
- 3+ years of experience as a Data Analyst
- Strong SQL and Power BI
- Python or R
- A/B testing
Nice to have: Go, C#
We offer: competitive salary, health insurance, modern office, hybrid work.`;

const ELENA = `Elena Rusu
elena.rusu@example.com | +373 69 555 012
Experience
Senior Data Analyst, Orange Moldova, March 2021 – Present
• Built Power BI dashboards used by 40 managers
Data Analyst, Moldcell, June 2018 – February 2021
• Ran A/B tests on 3 tariff launches
Education
BSc Computer Science, Technical University of Moldova, 2014 – 2018
Skills
Python, SQL, Power BI, Excel`;

const BENEFITS = `I love a fast-growing fintech in Chisinau with a competitive salary, health insurance, a modern office and hybrid work. About me: I am looking for an offer.`;

const labels = (reqs: { label: string }[]) => reqs.map((r) => r.label);

describe("what the post asks for", () => {
  it("skills and years, required or preferred by the headings; “About us” and “We offer” skipped", () => {
    const { skills, years } = requirementsOf(POST);
    expect(labels(skills.filter((s) => s.required))).toEqual(["SQL", "Power BI", "Python or R", "A/B testing"]);
    expect(labels(skills.filter((s) => !s.required))).toEqual(["Go", "C#"]);
    expect(years).toMatchObject({ n: 3 });
  });

  it("finds Power BI once (not “BI”), C#, and R only in a list", () => {
    expect(findSkills("Strong SQL and Power BI").map((h) => h.name)).toEqual(["SQL", "Power BI"]);
    expect(findSkills("Go, C#").map((h) => h.name)).toEqual(["Go", "C#"]);
    expect(findSkills("Python or R").map((h) => h.name)).toEqual(["Python", "R"]);
    expect(findSkills("R&D budget and a C grade")).toEqual([]);
  });

  it("“is a plus” on a line makes it preferred", () => {
    const { skills } = requirementsOf("Requirements:\n- SQL\n- Experience with Airflow is a plus");
    expect(skills.map((s) => [s.label, s.required])).toEqual([
      ["SQL", true],
      ["Airflow", false],
    ]);
  });

  it("reads Romanian and Russian posts", () => {
    const ro = requirementsOf("Cerințe:\n- minim 3 ani experiență\n- SQL\nConstituie un avantaj: Python");
    expect(ro.years).toMatchObject({ n: 3 });
    expect(ro.skills.map((s) => [s.label, s.required])).toEqual([
      ["SQL", true],
      ["Python", false],
    ]);
    const ru = requirementsOf("Требования:\n- опыт от 3 лет\n- SQL\nБудет плюсом: Python");
    expect(ru.years).toMatchObject({ n: 3 });
    expect(ru.skills.map((s) => [s.label, s.required])).toEqual([
      ["SQL", true],
      ["Python", false],
    ]);
  });

  it("the years in the ways posts write them", () => {
    expect(yearsAsked("3+ years of experience")).toBe(3);
    expect(yearsAsked("at least 5 years in data")).toBe(5);
    expect(yearsAsked("2–4 years")).toBe(2);
    expect(yearsAsked("4 years of hands-on experience")).toBe(4);
    expect(yearsAsked("Strong SQL")).toBeNull();
  });
});

describe("the match", () => {
  it("a paragraph about benefits meets no requirement", () => {
    const r = jobFit(BENEFITS, POST, TODAY);
    expect(r.required.met).toBe(0);
    expect(r.summary).toBe("few_required");
    expect(r.label).toBe("Meets few required");
  });

  it("Elena's CV meets every required one; the summary is HiredScore's “all required”", () => {
    const r = jobFit(ELENA, POST, TODAY);
    expect(r.required).toEqual({ met: 5, total: 5 }); // 3+ years, SQL, Power BI, Python or R, A/B testing
    expect(r.preferred).toEqual({ met: 0, total: 2 });
    expect(r.summary).toBe("all_required");
    const sql = r.requirements.find((x) => x.label === "SQL")!;
    expect(sql.where).toBe("In your Skills list");
    const powerBi = r.requirements.find((x) => x.label === "Power BI")!;
    expect(powerBi.where).toBe("In your Skills list and your job at Orange Moldova");
    expect(r.requirements[0]).toMatchObject({ kind: "years", status: "met", where: "8 yrs 6 mos from your jobs' dates" });
  });

  it("all required and most preferred", () => {
    const r = jobFit(`${ELENA}\nGo, C#`, POST, TODAY);
    expect(r.summary).toBe("all_required_most_preferred");
  });

  it("R alone meets “Python or R”; too few years is not met", () => {
    const cv = "Ion Rusu\nExperience\nAnalyst, Bank, January 2026 – Present\nSkills\nR, SQL, Power BI, A/B testing";
    const r = jobFit(cv, POST, TODAY);
    expect(r.requirements.find((x) => x.label === "Python or R")!.status).toBe("met");
    expect(r.requirements.find((x) => x.kind === "years")).toMatchObject({ status: "not_met", where: "11 mos from your jobs' dates" });
    expect(r.summary).toBe("most_required");
  });

  it("a post with nothing to check says so", () => {
    const r = jobFit(ELENA, "We are a friendly team. Join us!", TODAY);
    expect(r.summary).toBe("none_found");
    expect(r.requirements).toEqual([]);
  });

  it("no percentage anywhere, and the same input gives the same report", () => {
    const a = jobFit(ELENA, POST, TODAY);
    expect(JSON.stringify(a)).not.toMatch(/matchScore|%/);
    expect(jobFit(ELENA, POST, TODAY)).toEqual(a);
  });
});

describe("the sentence", () => {
  it("names what's missing, required first", () => {
    expect(jobFit(ELENA, POST, TODAY).message).toBe("Your CV shows everything the post marks as required. Nice to have, not shown: Go, C#.");
    expect(jobFit(BENEFITS, POST, TODAY).message).toMatch(/^Your CV doesn't show: 3\+ years of experience, SQL, Power BI, Python or R…\./);
  });
});
