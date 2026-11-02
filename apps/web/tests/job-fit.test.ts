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

  it("“or” and “and” in Romanian and Russian lists, with or without diacritics", () => {
    for (const post of ["Python или R", "Python и R", "Python și R", "Python si R", "Python sau R"])
      expect(findSkills(post).map((h) => h.name), post).toEqual(["Python", "R"]);
    expect(findSkills("python or r")).toMatchObject([{ name: "Python" }, { name: "R", start: 10, end: 11 }]);
    expect(findSkills("Отдел R&D и бюджет")).toEqual([]);
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

// Mara Lungu, a synthetic game designer, against posts like the one a tester brought (in Russian).
const GAME_POST_RU = `Геймдизайнер (контент), Lumen Games
Требования:
- опыт в геймдизайне от 3 лет
- знание Unity и Jira
- опыт работы с монетизацией и балансом экономики в F2P играх
Будет плюсом:
- нарративный дизайн
Мы предлагаем: удалённую работу и гибкий график.`;

const MARA = `Mara Lungu
Game Designer | F2P Games
Experience
Game Designer, Lumen Games, 03.2021 – present
- Led game design for 3 F2P titles in Unity; tracked tasks in Jira
- Tuned monetization and the game economy; wrote narrative design docs
Skills
Unity, Jira, level design`;

describe("posts and CVs in other languages, and game design", () => {
  it("a Russian post names the skills an English CV has: they meet on one key", () => {
    const { skills, years } = requirementsOf(GAME_POST_RU);
    expect(labels(skills.filter((s) => s.required))).toEqual(["Game design", "Unity", "Jira", "Monetization", "Game economy", "F2P"]);
    expect(labels(skills.filter((s) => !s.required))).toEqual(["Narrative design"]);
    expect(years).toMatchObject({ n: 3 });
    const fit = jobFit(MARA, GAME_POST_RU, TODAY);
    expect(fit.summary).toBe("all_required_most_preferred");
  });

  it("the ways people write Romanian and Russian: cedilla or comma, no diacritics, ё or е", () => {
    const names = (t: string) => findSkills(t).map((h) => h.name);
    expect(names("Achiziţii publice; Relaţii cu clienţii; Învăţare automată")).toEqual(["Procurement", "Customer service", "Machine learning"]);
    expect(names("vanzari, invatarea automata, relatii cu clientii, logistica")).toEqual(["Sales", "Machine learning", "Customer service", "Logistics"]);
    expect(names("Бухгалтерский учёт, бухгалтерский учет")).toEqual(["Accounting", "Accounting"]);
  });

  it("a Romanian form that is also an English word: 'logistic regression' is not Logistics", () => {
    const names = (t: string) => findSkills(t).map((h) => h.name);
    expect(names("Experience with logistic regression")).not.toContain("Logistics");
    expect(names("Logistica, logisticii, logistică")).toEqual(["Logistics", "Logistics", "Logistics"]);
  });

  it("Russian and Romanian word endings: cases and articles", () => {
    const names = (t: string) => findSkills(t).map((h) => h.name);
    expect(names("Опыт геймдизайна, знание геймдизайну и геймдизайном")).toEqual(["Game design", "Game design", "Game design"]);
    expect(names("Cerințe: analiza datelor, managementul proiectelor; avantaj: învățarea automată")).toEqual([
      "Data analysis",
      "Project management",
      "Machine learning",
    ]);
  });

  it("the game design words in English", () => {
    expect(findSkills("Game design, level design and LiveOps in Unreal Engine; free-to-play monetization").map((h) => h.name)).toEqual([
      "Game design",
      "Level design",
      "LiveOps",
      "Unreal Engine",
      "F2P",
      "Monetization",
    ]);
  });

  it("a job title or a near word isn't a skill", () => {
    expect(findSkills("Аналитик, дизайнер, геймер, analist, designer")).toEqual([]);
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

  it("a post with only nice-to-haves gets no “all required” grade", () => {
    const r = jobFit(ELENA, "Data Analyst\nNice to have: Go, SQL", TODAY);
    expect(r.required).toEqual({ met: 0, total: 0 });
    expect(r.preferred).toEqual({ met: 1, total: 2 });
    expect(r.summary).toBe("preferred_only");
    expect(r.label).toBe("No required items we can check");
    expect(r.message).toBe("We found nothing the post marks as required that we can check. Nice to have, not shown: Go.");
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
