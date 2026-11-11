import { describe, expect, it } from "vitest";
import {
  ANSWER_WAIT_DAYS, boardColumns, csvCell, followUpDue, FOLLOW_UP_DAYS, MIN_SENT_TO_COMPARE, platformOf, resultsByCv,
  trackerCsv, trackerStats, type TrackedJob,
} from "@/lib/tracker";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 3, 12);

const job = (over: Partial<TrackedJob>): TrackedJob => ({
  id: Math.random().toString(36).slice(2),
  company: "Acme", role: "Data Analyst", url: null, location: null, description: null, notes: null,
  status: "applied", appliedAt: NOW - 20 * DAY, submittedAt: NOW - 20 * DAY, followUpAt: null, archivedAt: null, cvId: null,
  ...over,
});

describe("platformOf: the ATS from the link's host", () => {
  it.each([
    ["https://boards.greenhouse.io/acme/jobs/1", "greenhouse"],
    ["https://job-boards.eu.greenhouse.io/acme/jobs/1", "greenhouse"],
    ["https://jobs.lever.co/acme/1", "lever"],
    ["https://jobs.ashbyhq.com/acme/1", "ashby"],
    ["https://acme.wd3.myworkdayjobs.com/en-US/careers/job/1", "workday"],
    ["https://ro.indeed.com/viewjob?jk=1", "indeed"],
    ["https://www.linkedin.com/jobs/view/1", "linkedin"],
    ["https://careers.acme.com/1", "other"],
    ["https://notgreenhouse.io.evil.com/1", "other"],
  ])("%s → %s", (url, platform) => {
    expect(platformOf(url)).toBe(platform);
  });
  it("no link, or not a link: unknown", () => {
    expect(platformOf(null)).toBe("unknown");
    expect(platformOf("not a link")).toBe("unknown");
  });
});

describe("followUpDue: Did you hear back?", () => {
  it(`asks ${FOLLOW_UP_DAYS} days after sending, about the oldest first`, () => {
    const older = job({ company: "Older", submittedAt: NOW - 30 * DAY });
    const newer = job({ company: "Newer", submittedAt: NOW - 15 * DAY });
    const tooSoon = job({ company: "Soon", submittedAt: NOW - 13 * DAY });
    expect(followUpDue([newer, tooSoon, older], NOW)?.company).toBe("Older");
    expect(followUpDue([tooSoon], NOW)).toBeNull();
  });
  it("waits for the date set by Not yet, and never asks about a saved, answered or archived job", () => {
    expect(followUpDue([job({ followUpAt: NOW + DAY })], NOW)).toBeNull();
    expect(followUpDue([job({ status: "saved", submittedAt: null })], NOW)).toBeNull();
    expect(followUpDue([job({ status: "interview" })], NOW)).toBeNull();
    expect(followUpDue([job({ archivedAt: NOW - DAY })], NOW)).toBeNull();
  });
});

describe("trackerStats", () => {
  it("counts sent jobs, answers and interviews; a rejection after an interview is still an interview", () => {
    const s = trackerStats([
      job({ status: "saved", submittedAt: null }),
      job({ status: "applied" }),
      job({ status: "interview" }),
      job({ status: "rejected", reachedInterview: true }),
      job({ status: "rejected" }),
      job({ status: "applied", archivedAt: NOW }),
    ]);
    expect(s).toEqual({ sent: 5, answered: 3, interviews: 2 });
  });
});

describe("resultsByCv: which CV gets answers", () => {
  const old = (over: Partial<TrackedJob>) => job({ submittedAt: NOW - ANSWER_WAIT_DAYS * DAY, ...over });

  it("counts sent jobs, answers and interviews per CV, the most sent first", () => {
    const { rows } = resultsByCv([
      old({ cvId: "base", status: "applied" }),
      old({ cvId: "base", status: "rejected" }),
      old({ cvId: "tailored", status: "interview" }),
      old({ cvId: "tailored", status: "rejected", reachedInterview: true }),
      old({ cvId: "tailored", status: "applied", archivedAt: NOW - DAY }),
      old({ cvId: "other", status: "offer" }),
    ], NOW);
    expect(rows).toEqual([
      { cvId: "tailored", sent: 3, answered: 2, interviews: 2, tooFew: true },
      { cvId: "base", sent: 2, answered: 1, interviews: 0, tooFew: true },
      { cvId: "other", sent: 1, answered: 1, interviews: 1, tooFew: true },
    ]);
  });

  it(`leaves out jobs sent less than ${ANSWER_WAIT_DAYS} days ago, and saved ones`, () => {
    const { rows } = resultsByCv([
      job({ cvId: "base", submittedAt: NOW - (ANSWER_WAIT_DAYS - 1) * DAY, status: "rejected" }),
      job({ cvId: "base", status: "saved", submittedAt: null }),
    ], NOW);
    expect(rows).toEqual([]);
  });

  it("counts sent jobs with no CV marked, of any age, so the page can ask", () => {
    const r = resultsByCv([old({ cvId: null }), job({ cvId: null, submittedAt: NOW - DAY }), job({ status: "saved", submittedAt: null })], NOW);
    expect(r).toEqual({ rows: [], unmarked: 2 });
  });

  it(`compares only from ${MIN_SENT_TO_COMPARE} sent`, () => {
    const many = Array.from({ length: MIN_SENT_TO_COMPARE }, () => old({ cvId: "base" }));
    expect(resultsByCv(many, NOW).rows[0]).toMatchObject({ sent: MIN_SENT_TO_COMPARE, tooFew: false });
  });
});

describe("boardColumns", () => {
  it("groups by status, hides the archive and filters on company or role", () => {
    const cols = boardColumns([
      job({ company: "Brightwave", status: "saved" }),
      job({ company: "Kite", role: "Data Scientist", status: "rejected" }),
      job({ company: "Gone", archivedAt: NOW }),
    ], "");
    expect(cols.saved.map((j) => j.company)).toEqual(["Brightwave"]);
    expect(cols.rejected.length).toBe(1);
    expect(Object.values(cols).flat().some((j) => j.company === "Gone")).toBe(false);
    expect(boardColumns([job({ company: "Kite", role: "Data Scientist" })], "scient").applied.length).toBe(1);
    expect(boardColumns([job({ company: "Kite" })], "zzz").applied.length).toBe(0);
  });
});

describe("the CSV export", () => {
  it("puts an apostrophe before anything that would run as a formula", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvCell("+40 700")).toBe("'+40 700");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("Data, Analyst")).toBe("\"Data, Analyst\"");
    expect(csvCell(null)).toBe("");
  });
  it("has a header and one line per job, archived ones included", () => {
    const csv = trackerCsv([job({ company: "Acme" }), job({ company: "Old", archivedAt: NOW })]);
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe("Company,Role,Status,Link,Location,Added,Sent,Archived,Notes");
    expect(lines.length).toBe(3);
    expect(lines[2]).toContain("2026-11-03");
  });
});
