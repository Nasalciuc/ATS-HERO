// Daily search, the run: apps/ai is a fake fetch, the database the real migrations (PGlite).
// New postings land in Saved with their history line; the tracker's links are left alone; the CV
// never leaves; a failure is recorded on the search.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb } from "./setup";
import { applicationEvents, applications, cvs, jobSearches, type JobSearch } from "@/db/schema";
import { emptyCvData, type CvData } from "@/lib/types";

const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));

import { dueSearches, runJobSearch, SearchFailed } from "@/lib/job-search-run";

let db: Awaited<ReturnType<typeof makeTestDb>>;
beforeEach(async () => {
  db = await makeTestDb();
  holder.db = db;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const NOW = new Date("2026-11-04T07:30:00Z");

const cvData = (): CvData => {
  const d = emptyCvData();
  d.personalInfo.name = "Zorina Vulpescu";
  d.personalInfo.email = "zorina.vulpescu@example.com";
  d.skills = ["SQL", "Python", "Excel"];
  return d;
};

async function makeSearch(over: Partial<typeof jobSearches.$inferInsert> = {}): Promise<JobSearch> {
  const [s] = await db.insert(jobSearches).values({
    ownerId: "u1", searchTerm: "Data Analyst", country: "romania", city: "Bucharest", boards: ["indeed", "linkedin"], perDay: 2, ...over,
  }).returning();
  return s;
}

const posting = (n: number, description: string) => ({
  site: "indeed", title: `Data Analyst ${n}`, company: `Company ${n}`, location: "Bucharest",
  date_posted: "2026-11-03", job_url: `https://ro.indeed.com/viewjob?jk=${n}`, job_url_direct: null, description,
});

function fakeAi(body: unknown, status = 200) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe("runJobSearch", () => {
  it("adds the best new postings to Saved, each with its history line, and records the run", async () => {
    await db.insert(cvs).values({ ownerId: "u1", title: "Base", data: cvData() });
    const search = await makeSearch();
    const { f, calls } = fakeAi({
      count: 3, by_site: { indeed: 3, linkedin: 0 }, errors: {},
      jobs: [posting(1, "Required: Power BI."), posting(2, "Requirements: SQL, Python."), posting(3, "Must have: SQL, Excel.")],
    });
    const r = await runJobSearch(search, { fetch: f, aiUrl: "http://ai", now: NOW });
    expect(r).toEqual({ found: 3, added: 2, repeats: 0, failed: [] });

    const rows = await db.select().from(applications).where(eq(applications.ownerId, "u1"));
    expect(rows.map((a) => [a.company, a.status, a.source, a.platform, a.submittedAt]).sort()).toEqual([
      ["Company 2", "saved", "job_search", "indeed", null],
      ["Company 3", "saved", "job_search", "indeed", null],
    ]);
    const events = await db.select().from(applicationEvents);
    expect(events.map((e) => [e.kind, e.toStatus, e.ownerId])).toEqual([["created", "saved", "u1"], ["created", "saved", "u1"]]);
    const [after] = await db.select().from(jobSearches).where(eq(jobSearches.id, search.id));
    expect(after).toMatchObject({ lastFound: 3, lastAdded: 2, lastError: null, lastRunAt: NOW });

    // only the title and the place went out: no CV, no name, no e-mail, no skill
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://ai/jobs/search");
    const sent = JSON.stringify(calls[0].body);
    expect(sent).toContain("Data Analyst");
    expect(sent).not.toMatch(/Zorina|Vulpescu|example\.com|Python/);
  });

  it("leaves a job already in the tracker alone, and doesn't count it as added", async () => {
    await db.insert(applications).values({
      ownerId: "u1", company: "Company 1", role: "Analyst", url: "https://ro.indeed.com/viewjob?jk=1", urlKey: "ro.indeed.com/viewjob?jk=1", status: "applied",
    });
    const search = await makeSearch();
    const { f } = fakeAi({ count: 2, by_site: { indeed: 2 }, errors: {}, jobs: [posting(1, "SQL"), posting(2, "SQL")] });
    const r = await runJobSearch(search, { fetch: f, now: NOW });
    expect(r).toMatchObject({ found: 2, added: 1, repeats: 1 });
    const one = await db.select().from(applications).where(eq(applications.urlKey, "ro.indeed.com/viewjob?jk=1"));
    expect(one).toHaveLength(1);
    expect(one[0].status).toBe("applied");
  });

  it("another owner's tracker doesn't count as a repeat, and their search adds to their own", async () => {
    await db.insert(applications).values({ ownerId: "u2", company: "Company 1", role: "Analyst", urlKey: "ro.indeed.com/viewjob?jk=1" });
    const search = await makeSearch();
    const { f } = fakeAi({ count: 1, by_site: { indeed: 1 }, errors: {}, jobs: [posting(1, "SQL")] });
    expect(await runJobSearch(search, { fetch: f, now: NOW })).toMatchObject({ added: 1, repeats: 0 });
  });

  it("records a failure on the search and throws a message the screen can show", async () => {
    const search = await makeSearch();
    const { f } = fakeAi({ detail: "boards failed" }, 502);
    await expect(runJobSearch(search, { fetch: f, now: NOW })).rejects.toBeInstanceOf(SearchFailed);
    const [after] = await db.select().from(jobSearches).where(eq(jobSearches.id, search.id));
    expect(after).toMatchObject({ lastFound: 0, lastAdded: 0, lastRunAt: NOW });
    expect(after.lastError).toMatch(/didn’t answer/);
    expect(await db.select().from(applications)).toEqual([]);
  });

  it("names the boards that failed, keeping nothing they said", async () => {
    const search = await makeSearch();
    const { f } = fakeAi({ count: 0, by_site: { indeed: 0, linkedin: 0 }, errors: { linkedin: "HTTP 429 for Data Analyst in Bucharest", indeed: "blocked" }, jobs: [] });
    const r = await runJobSearch(search, { fetch: f, now: NOW });
    expect(r.failed.sort()).toEqual(["Indeed", "LinkedIn"]);
    const [after] = await db.select().from(jobSearches).where(eq(jobSearches.id, search.id));
    expect(after.lastError).toMatch(/didn’t answer\.$/);
    expect(after.lastError).not.toContain("Bucharest");
  });
});

describe("up to N a day", () => {
  it("adds no more than the search's number a day, over every run that day", async () => {
    await db.insert(cvs).values({ ownerId: "u1", title: "Base", data: cvData() });
    const search = await makeSearch(); // 2 a day
    const first = fakeAi({ count: 3, by_site: { indeed: 3 }, errors: {}, jobs: [posting(1, "SQL"), posting(2, "SQL"), posting(3, "SQL")] });
    expect((await runJobSearch(search, { fetch: first.f, aiUrl: "http://ai", now: NOW })).added).toBe(2);
    // later the same day: the boards aren't asked
    const second = fakeAi({ count: 1, by_site: { indeed: 1 }, errors: {}, jobs: [posting(4, "SQL")] });
    expect(await runJobSearch(search, { fetch: second.f, aiUrl: "http://ai", now: new Date(NOW.getTime() + 3600e3) }))
      .toEqual({ found: 0, added: 0, repeats: 0, failed: [] });
    expect(second.calls).toHaveLength(0);
    // the next day there is room again
    const third = fakeAi({ count: 1, by_site: { indeed: 1 }, errors: {}, jobs: [posting(5, "SQL")] });
    expect((await runJobSearch(search, { fetch: third.f, aiUrl: "http://ai", now: new Date("2026-11-05T04:30:00Z") })).added).toBe(1);
  });
});

describe("dueSearches", () => {
  it("reaches a search that never ran first, then the one run longest ago", async () => {
    await makeSearch({ ownerId: "old", lastRunAt: new Date("2026-11-01T07:30:00Z") });
    await makeSearch({ ownerId: "older", lastRunAt: new Date("2026-10-30T07:30:00Z") });
    await makeSearch({ ownerId: "new" });
    expect((await dueSearches(NOW, 2)).map((s) => s.ownerId)).toEqual(["new", "older"]);
  });

  it("returns the searches that are on and haven't run since the day began", async () => {
    await makeSearch({ ownerId: "never" });
    await makeSearch({ ownerId: "yesterday", lastRunAt: new Date("2026-11-03T07:30:00Z") });
    await makeSearch({ ownerId: "today", lastRunAt: new Date("2026-11-04T05:00:00Z") });
    await makeSearch({ ownerId: "off", enabled: false });
    const due = await dueSearches(NOW, 10);
    expect(due.map((s) => s.ownerId).sort()).toEqual(["never", "yesterday"]);
  });
});
