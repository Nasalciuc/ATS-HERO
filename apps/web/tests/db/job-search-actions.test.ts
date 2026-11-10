// Daily search, the actions and the morning run, on the real migrations (PGlite). Off unless the
// switch is on; each person sees and runs only their own search; "Search now" waits a few minutes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb } from "./setup";
import { applications, cvs, jobSearches } from "@/db/schema";
import { emptyCvData } from "@/lib/types";

const holder = vi.hoisted(() => ({ db: null as unknown, owner: null as string | null }));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@/app/actions/_shared", () => ({ getOwnerId: async () => holder.owner }));
// the morning run's gap between two searches, short here (10 s in the app)
vi.mock("@/lib/job-search", async (original) => ({ ...(await original<typeof import("@/lib/job-search")>()), CRON_SEARCH_GAP_MS: 300 }));

import { getMyJobSearch, runMyJobSearchNow, saveJobSearch } from "@/app/actions/job-search";
import { GET as cron } from "@/app/api/cron/job-search/route";

let db: Awaited<ReturnType<typeof makeTestDb>>;
let aiCalls = 0;
let aiCalledAt: number[] = [];
beforeEach(async () => {
  db = await makeTestDb();
  holder.db = db;
  holder.owner = "u1";
  aiCalls = 0;
  aiCalledAt = [];
  vi.stubEnv("NEXT_PUBLIC_JOB_SEARCH_ENABLED", "true");
  vi.stubEnv("CRON_SECRET", "test-secret");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", async () => {
    aiCalls++;
    aiCalledAt.push(Date.now());
    return new Response(JSON.stringify({
      count: 1, by_site: { indeed: 1 }, errors: {},
      jobs: [{ site: "indeed", title: "Data Analyst", company: `Acme ${aiCalls}`, job_url: `https://ro.indeed.com/viewjob?jk=${aiCalls}`, description: "SQL" }],
    }), { status: 200 });
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const input = { searchTerm: "Data Analyst", country: "romania", city: "Bucharest", boards: ["indeed", "linkedin"], perDay: 10 };

describe("saveJobSearch / getMyJobSearch", () => {
  it("saves one search per person and changes it in place", async () => {
    const first = await saveJobSearch(input);
    expect(first).toMatchObject({ ok: true, search: { searchTerm: "Data Analyst", perDay: 10, enabled: true, cvId: null } });
    const again = await saveJobSearch({ ...input, perDay: 5, enabled: false });
    expect(again).toMatchObject({ ok: true, search: { perDay: 5, enabled: false } });
    expect(await db.select().from(jobSearches)).toHaveLength(1);
    expect(await getMyJobSearch()).toMatchObject({ perDay: 5, enabled: false, city: "Bucharest" });
  });

  it("refuses a bad title, an unknown country, no board, more than 20 a day", async () => {
    for (const bad of [
      { ...input, searchTerm: "x" },
      { ...input, country: "atlantis" },
      { ...input, boards: [] },
      { ...input, boards: ["glassdoor"] },
      { ...input, perDay: 21 },
    ]) {
      expect(await saveJobSearch(bad)).toMatchObject({ ok: false });
    }
    expect(await db.select().from(jobSearches)).toEqual([]);
  });

  it("checks against one of the person's CVs only", async () => {
    const [theirs] = await db.insert(cvs).values({ ownerId: "u2", title: "Not mine", data: emptyCvData() }).returning();
    expect(await saveJobSearch({ ...input, cvId: theirs.id })).toEqual({ ok: false, message: "Choose one of your CVs." });
    expect(await db.select().from(jobSearches)).toEqual([]);
    const [mine] = await db.insert(cvs).values({ ownerId: "u1", title: "Mine", data: emptyCvData() }).returning();
    expect(await saveJobSearch({ ...input, cvId: mine.id })).toMatchObject({ ok: true, search: { cvId: mine.id } });
  });

  it("another person sees only their own search", async () => {
    await saveJobSearch(input);
    holder.owner = "u2";
    expect(await getMyJobSearch()).toBeNull();
  });

  it("does nothing when signed out or switched off", async () => {
    holder.owner = null;
    expect(await saveJobSearch(input)).toMatchObject({ ok: false });
    holder.owner = "u1";
    vi.stubEnv("NEXT_PUBLIC_JOB_SEARCH_ENABLED", "false");
    expect(await saveJobSearch(input)).toMatchObject({ ok: false, message: "Daily search isn’t available yet." });
    expect(await getMyJobSearch()).toBeNull();
    expect(await db.select().from(jobSearches)).toEqual([]);
  });
});

describe("runMyJobSearchNow, pressed twice or after the day's jobs", () => {
  it("runs once when pressed twice at once", async () => {
    await saveJobSearch(input);
    const [a, b] = await Promise.all([runMyJobSearchNow(), runMyJobSearchNow()]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect([a, b].find((r) => !r.ok)).toMatchObject({ message: "You searched a moment ago. Try again in a few minutes." });
    expect(aiCalls).toBe(1);
  });

  it("doesn't search once today's jobs are in Saved", async () => {
    await saveJobSearch({ ...input, perDay: 1 });
    expect(await runMyJobSearchNow()).toMatchObject({ ok: true, summary: { added: 1 } });
    await db.update(jobSearches).set({ lastRunAt: new Date(Date.now() - 3600e3) });
    expect(await runMyJobSearchNow()).toEqual({
      ok: false, message: "Saved already has today’s 1 new job from the search. The next search runs tomorrow morning.",
    });
    expect(aiCalls).toBe(1);
  });
});

describe("runMyJobSearchNow", () => {
  it("runs the person's search, then waits a few minutes before another", async () => {
    expect(await runMyJobSearchNow()).toEqual({ ok: false, message: "Save the search first." });
    await saveJobSearch(input);
    const r = await runMyJobSearchNow();
    expect(r).toMatchObject({ ok: true, summary: { found: 1, added: 1 }, search: { lastAdded: 1 } });
    expect(await runMyJobSearchNow()).toMatchObject({ ok: false, message: expect.stringMatching(/a moment ago/) });
    expect(aiCalls).toBe(1);
    expect(await db.select().from(applications).where(eq(applications.ownerId, "u1"))).toHaveLength(1);
  });

  it("claims, runs and reads back only the person's own search", async () => {
    await saveJobSearch(input);
    holder.owner = "u2";
    await saveJobSearch({ ...input, searchTerm: "Nurse" });
    expect(await runMyJobSearchNow()).toMatchObject({ ok: true, search: { searchTerm: "Nurse", lastAdded: 1 } });
    const rows = await db.select().from(jobSearches);
    expect(rows.find((s) => s.ownerId === "u1")).toMatchObject({ lastRunAt: null, lastAdded: null });
    expect(rows.find((s) => s.ownerId === "u2")?.lastRunAt).toBeInstanceOf(Date);
    expect((await db.select().from(applications)).map((a) => a.ownerId)).toEqual(["u2"]);
  });

  it("logs every step under the person's id: the claim, the run, the read", async () => {
    await saveJobSearch(input);
    const log = vi.mocked(console.log);
    log.mockClear();
    await runMyJobSearchNow();
    const lines = log.mock.calls.map(([line]) => JSON.parse(String(line)) as { action: string; ownerId: string });
    expect(lines.map((l) => l.action)).toEqual(["jobSearch.claim", "jobSearch.run", "jobSearch.get"]);
    expect(lines.map((l) => l.ownerId)).toEqual(["u1", "u1", "u1"]);
    // a press refused by the gap is one logged step, and no run
    log.mockClear();
    await runMyJobSearchNow();
    expect(log.mock.calls.map(([line]) => JSON.parse(String(line)).action)).toEqual(["jobSearch.claim"]);
  });
});

describe("/api/cron/job-search", () => {
  const call = (auth?: string) => cron(new Request("http://x/api/cron/job-search", { headers: auth ? { authorization: auth } : {} }));

  it("needs the cron secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
  });

  it("runs every search that is on and due, each into its own tracker", async () => {
    await saveJobSearch(input);
    holder.owner = "u2";
    await saveJobSearch(input);
    holder.owner = "u3";
    await saveJobSearch({ ...input, enabled: false });
    const res = await call("Bearer test-secret");
    expect(await res.json()).toEqual({ searches: 2, added: 2, failed: 0 });
    const owners = (await db.select().from(applications)).map((a) => a.ownerId).sort();
    expect(owners).toEqual(["u1", "u2"]);
    // no faster than apps/ai takes them from one address
    expect(aiCalledAt[1] - aiCalledAt[0]).toBeGreaterThanOrEqual(290);
    // a second call the same day finds nothing due
    expect(await (await call("Bearer test-secret")).json()).toEqual({ searches: 0, added: 0, failed: 0 });
  });

  it("does nothing when switched off", async () => {
    await saveJobSearch(input);
    vi.stubEnv("NEXT_PUBLIC_JOB_SEARCH_ENABLED", "false");
    expect(await (await call("Bearer test-secret")).json()).toEqual({ disabled: true });
    expect(aiCalls).toBe(0);
  });
});
