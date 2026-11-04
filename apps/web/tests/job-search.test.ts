import { describe, expect, it } from "vitest";
import { boardsFor, HOURS_OLD, pickPostings, searchRequest, type Posting } from "@/lib/job-search";

const CV = [
  "EXPERIENCE",
  "Data Analyst · Delta Retail · Jan 2021 – Present",
  "Built weekly sales reports with SQL and Python; dashboards in Excel.",
  "SKILLS",
  "SQL · Python · Excel",
].join("\n");

const post = (n: number, over: Partial<Posting> = {}): Posting => ({
  site: "indeed",
  title: `Data Analyst ${n}`,
  company: `Company ${n}`,
  location: "Bucharest, RO",
  date_posted: "2026-11-03",
  job_url: `https://ro.indeed.com/viewjob?jk=${n}`,
  job_url_direct: null,
  description: "Requirements: SQL, Python.",
  ...over,
});

describe("searchRequest: what goes to apps/ai", () => {
  it("only the title and the place, the boards, the last day and a half", () => {
    expect(searchRequest({
      searchTerm: "  Data Analyst ", country: "romania", city: "Bucharest", remoteOnly: false, boards: ["indeed", "linkedin"], perDay: 10,
    })).toEqual({
      search_term: "Data Analyst", location: "Bucharest, Romania", sites: ["indeed", "linkedin"], country: "romania",
      results_wanted: 50, hours_old: HOURS_OLD, is_remote: false,
    });
  });

  it("Moldova has no Indeed: only LinkedIn's list, with a country JobSpy accepts", () => {
    const s = { searchTerm: "Programator", country: "moldova", city: "Chisinau", remoteOnly: false, boards: ["indeed", "linkedin"] as const, perDay: 5 };
    expect(boardsFor({ ...s, boards: [...s.boards] })).toEqual(["linkedin"]);
    expect(searchRequest({ ...s, boards: [...s.boards] })).toMatchObject({ sites: ["linkedin"], country: "usa", location: "Chisinau, Moldova" });
  });
});

describe("pickPostings: the best few, new ones only", () => {
  it("puts first the posts whose required items the CV shows, and keeps perDay", () => {
    const r = pickPostings([
      post(1, { description: "Required: Power BI, Tableau." }),
      post(2, { description: "Requirements: SQL, Python, Excel." }),
      post(3, { description: "We are a friendly team." }),
      post(4, { description: "Must have: SQL, Power BI." }),
    ], { existingKeys: new Set(), cvText: CV, perDay: 2 });
    expect(r.found).toBe(4);
    expect(r.picked.map((p) => p.company)).toEqual(["Company 2", "Company 4"]);
    expect(r.picked[0].fit?.required).toEqual({ met: 3, total: 3 });
  });

  it("leaves out jobs already in the tracker and the same job twice, by its link", () => {
    const r = pickPostings([
      post(1),
      post(2, { job_url: "https://ro.indeed.com/viewjob?jk=2&utm_source=x" }),
      post(2),
      post(3),
    ], { existingKeys: new Set(["ro.indeed.com/viewjob?jk=1"]), cvText: CV, perDay: 10 });
    expect(r.picked.map((p) => p.company)).toEqual(["Company 2", "Company 3"]);
    expect(r.repeats).toBe(2);
  });

  it("keeps the employer's own link when the board gives one", () => {
    const [p] = pickPostings([post(1, { job_url_direct: "https://boards.greenhouse.io/acme/jobs/1" })], { existingKeys: new Set(), cvText: CV, perDay: 5 }).picked;
    expect(p.url).toBe("https://boards.greenhouse.io/acme/jobs/1");
    expect(p.urlKey).toBe("boards.greenhouse.io/acme/jobs/1");
  });

  it("skips a posting without a usable link, title or company", () => {
    const r = pickPostings([
      post(1, { job_url: "javascript:alert(1)" }),
      post(2, { title: "  " }),
      post(3, { company: null }),
      post(4),
    ], { existingKeys: new Set(), cvText: CV, perDay: 10 });
    expect(r.picked.map((p) => p.company)).toEqual(["Company 4"]);
  });

  it("with no CV, the newest first and no check", () => {
    const r = pickPostings([post(1, { date_posted: "2026-11-01" }), post(2, { date_posted: "2026-11-03" })], { existingKeys: new Set(), cvText: null, perDay: 10 });
    expect(r.picked.map((p) => [p.company, p.fit])).toEqual([["Company 2", null], ["Company 1", null]]);
  });
});
