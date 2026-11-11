// Interview Trainer, step 4: the actions behind the screens, on the real migrations (PGlite). Off
// unless the switch is on, and only with an account; the pack is made on the server from the owner's
// job and CV; an answer is measured on the server and written once; 20 sessions a month; nobody
// reaches another person's job, CV or session.
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb } from "./setup";
import { applicationEvents, applications, cvs, interviewSessions } from "@/db/schema";
import { lineAt } from "@/lib/interview/pack";
import type { CvData } from "@/lib/types";

const holder = vi.hoisted(() => ({ db: null as unknown, owner: null as string | null }));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@/app/actions/_shared", () => ({ getOwnerId: async () => holder.owner }));

import {
  answerPrepared, answerQuestion, deleteInterview, endInterview, getInterview, getPracticeCounts, getReport, getSetup,
  getTrainerHome, pauseInterview, practiceAgain, skipQuestion, startInterview,
} from "@/app/actions/interview";

const personas = JSON.parse(fs.readFileSync(path.join(process.cwd(), "../../tools/ats-lab/fixtures/personas.json"), "utf8")) as Record<string, CvData>;
const POST = "Data Analyst\nRequirements:\n- SQL\n- Python\n- Power BI\n- Snowflake\nNice to have: Tableau";

let db: Awaited<ReturnType<typeof makeTestDb>>;
beforeEach(async () => {
  db = await makeTestDb();
  holder.db = db;
  holder.owner = "u1";
  vi.stubEnv("NEXT_PUBLIC_INTERVIEW_TRAINER_ENABLED", "true");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function cv(ownerId = "u1", title = "Data Analyst CV", data = personas.amara) {
  const [row] = await db.insert(cvs).values({ ownerId, title, data }).returning();
  return row;
}
async function job(ownerId = "u1", o: Partial<typeof applications.$inferInsert> = {}) {
  const [row] = await db.insert(applications).values({
    ownerId, company: "Altamira Tech", role: "Data Analyst", status: "interview", description: POST, ...o,
  }).returning();
  return row;
}
const start = (applicationId: string, cvId: string, o: Partial<Parameters<typeof startInterview>[0]> = {}) =>
  startInterview({ applicationId, cvId, kind: "technical", minutes: 10, feedbackWhen: "each", timer: false, ...o });

async function started() {
  const c = await cv();
  const j = await job();
  const r = await start(j.id, c.id);
  if (!r.ok) throw new Error(r.message);
  return { c, j, id: r.id };
}

describe("the switch and the account", () => {
  it("is off unless the switch is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_INTERVIEW_TRAINER_ENABLED", "");
    expect(await getTrainerHome()).toEqual({ ok: false, message: "The Interview Trainer isn’t available yet." });
    expect(await getPracticeCounts()).toMatchObject({ ok: false });
  });

  it("needs an account", async () => {
    holder.owner = null;
    expect(await getTrainerHome()).toEqual({ ok: false, message: "Sign in to practice." });
  });
});

describe("setup", () => {
  it("uses the CV sent for the job, else the latest, else the one chosen; and lists what the post asks", async () => {
    const older = await cv("u1", "Older CV");
    const latest = await cv("u1", "Latest CV");
    await db.update(cvs).set({ updatedAt: new Date(Date.now() - 864e5) }).where(eq(cvs.id, older.id));
    const plain = await job();
    const sent = await job("u1", { cvId: older.id, url: "https://jobs.example/2" });
    const a = await getSetup(plain.id);
    const b = await getSetup(sent.id);
    const c = await getSetup(sent.id, latest.id);
    expect(a.ok && a.setup.cv).toEqual({ id: latest.id, title: "Latest CV", why: "latest" });
    expect(b.ok && b.setup.cv).toEqual({ id: older.id, title: "Older CV", why: "sent" });
    expect(c.ok && c.setup.cv).toEqual({ id: latest.id, title: "Latest CV", why: "chosen" });
    expect(a.ok && a.setup.items).toEqual([
      { label: "SQL", required: true, inCv: true },
      { label: "Python", required: true, inCv: true },
      { label: "Power BI", required: true, inCv: true },
      { label: "Snowflake", required: true, inCv: false },
      { label: "Tableau", required: false, inCv: true },
    ]);
    expect(a).toMatchObject({ ok: true, setup: { hasLines: true, hasPost: true, used: 0, limit: 20, sessions: 0 } });
  });

  it("says when there is no CV to ask from", async () => {
    const j = await job();
    expect(await getSetup(j.id)).toMatchObject({ ok: true, setup: { cv: null, hasLines: false, cvs: [] } });
  });
});

describe("a typed session", () => {
  it("is made on the server from the owner's job and CV, every question tied to a line of the CV", async () => {
    const { c, id } = await started();
    const r = await getInterview(id);
    if (!r.ok) throw new Error(r.message);
    expect(r.session).toMatchObject({ role: "Data Analyst", company: "Altamira Tech", kind: "technical", mode: "typing", status: "live", turns: [] });
    expect(r.session.questions).toHaveLength(4);
    const [row] = await db.select().from(interviewSessions).where(eq(interviewSessions.id, id));
    for (const q of row.pack.questions) expect(lineAt(c.data, q.bullet.ref)?.text).toBe(q.bullet.text);
    expect(row).toMatchObject({ style: "friendly", englishNotes: false, mode: "typing" });
  });

  it("measures an answer on the server, with the requirement and the proof from the CV", async () => {
    const { id } = await started();
    const v = await getInterview(id);
    if (!v.ok) throw new Error(v.message);
    const q = v.session.questions.find((x) => x.requirement?.includes("Power BI"))!;
    const r = await answerQuestion(id, {
      questionId: q.id, seconds: 45, secondsUsed: 60,
      answer: "At Flutterwave I built Power BI dashboards that 40 people in operations used every day.",
    });
    expect(r).toMatchObject({ ok: true, turn: { questionId: q.id, words: 15, seconds: 45, named: expect.arrayContaining(["Power BI"]) } });
    if (!r.ok) return;
    expect(r.turn.criteria.find((c) => c.key === "proof")).toMatchObject({ met: true });
    expect(r.turn.used).toEqual(expect.arrayContaining(["40", "Power BI"]));
  });

  it("refuses an empty or very long answer, and a question that isn't in the session", async () => {
    const { id } = await started();
    expect(await answerQuestion(id, { questionId: "q1", answer: "  ", seconds: 1, secondsUsed: 1 }))
      .toEqual({ ok: false, message: "Type your answer first, or skip the question." });
    expect(await answerQuestion(id, { questionId: "q1", answer: "x".repeat(6001), seconds: 1, secondsUsed: 1 }))
      .toEqual({ ok: false, message: "Keep your answer under 6,000 characters." });
    expect(await answerQuestion(id, { questionId: "q9", answer: "Yes", seconds: 1, secondsUsed: 1 }))
      .toEqual({ ok: false, message: "That question isn’t in this interview." });
  });

  it("takes text only as an answer, without the spaces around it, up to 6,000 characters", async () => {
    const { id } = await started();
    for (const notText of [42, null, undefined, { text: "Yes" }]) {
      expect(await answerQuestion(id, { questionId: "q1", answer: notText as never, seconds: 1, secondsUsed: 1 }))
        .toEqual({ ok: false, message: "Type your answer first, or skip the question." });
    }
    expect(await answerQuestion(id, { questionId: "q1", answer: "  I cut the report from 6 hours to 1.  ", seconds: 5, secondsUsed: 5 }))
      .toMatchObject({ ok: true, turn: { answer: "I cut the report from 6 hours to 1." } });
    expect(await answerQuestion(id, { questionId: "q1", answer: "x".repeat(6000), seconds: 5, secondsUsed: 5 })).toMatchObject({ ok: true });
  });

  it("pauses and resumes only on a yes or a no", async () => {
    const { id } = await started();
    const status = async () => (await db.select().from(interviewSessions).where(eq(interviewSessions.id, id)))[0].status;
    const before = await status();
    for (const notYesOrNo of ["false", 1, null, undefined]) {
      expect(await pauseInterview(id, notYesOrNo as never, 2))
        .toEqual({ ok: false, message: "We couldn’t find this interview. It may have been deleted." });
    }
    expect(await status()).toBe(before);
  });

  it("takes an answer three times at most; a skipped question takes none", async () => {
    const { id } = await started();
    for (const n of [1, 2, 3]) expect(await answerQuestion(id, { questionId: "q1", answer: `Try ${n}`, seconds: 5, secondsUsed: 5 })).toMatchObject({ ok: true });
    expect(await answerQuestion(id, { questionId: "q1", answer: "Try 4", seconds: 5, secondsUsed: 5 }))
      .toEqual({ ok: false, message: "You’ve answered this one 3 times. Go on to the next question." });
    expect(await skipQuestion(id, { questionId: "q2", secondsUsed: 10 })).toMatchObject({ ok: true, turn: { answer: null } });
    expect(await skipQuestion(id, { questionId: "q2", secondsUsed: 10 })).toEqual({ ok: false, message: "This question already has an answer." });
    expect(await answerQuestion(id, { questionId: "q2", answer: "Now", seconds: 5, secondsUsed: 5 })).toEqual({ ok: false, message: "You skipped this question." });
    const v = await getInterview(id);
    expect(v.ok && v.session.turns.map((t) => [t.questionId, t.answer])).toEqual([["q1", "Try 1"], ["q1", "Try 2"], ["q1", "Try 3"], ["q2", null]]);
  });

  it("keeps the time used, never more than the time since it started", async () => {
    const { id } = await started();
    await answerQuestion(id, { questionId: "q1", answer: "An answer", seconds: 5, secondsUsed: 3000 });
    const [row] = await db.select().from(interviewSessions).where(eq(interviewSessions.id, id));
    expect(row.secondsUsed).toBeLessThanOrEqual(5);
    expect(await pauseInterview(id, true, 2)).toEqual({ ok: true });
    expect((await db.select().from(interviewSessions).where(eq(interviewSessions.id, id)))[0].status).toBe("paused");
    expect(await pauseInterview(id, false, 2)).toEqual({ ok: true });
  });

  it("ends for good: no answer after it, and the report is made from what was said", async () => {
    const { id } = await started();
    await answerQuestion(id, { questionId: "q1", answer: "I used SQL to cut a report from 6 hours to 1.", seconds: 30, secondsUsed: 30 });
    await skipQuestion(id, { questionId: "q2", secondsUsed: 40 });
    expect(await answerPrepared(id, "yes")).toEqual({ ok: false, message: "Finish the interview first." });
    expect(await endInterview(id, 50)).toEqual({ ok: true });
    expect(await endInterview(id, 50)).toEqual({ ok: true });
    expect(await answerQuestion(id, { questionId: "q3", answer: "Late", seconds: 1, secondsUsed: 1 }))
      .toEqual({ ok: false, message: "This interview has ended." });
    const r = await getReport(id);
    if (!r.ok) throw new Error(r.message);
    expect(r.report).toMatchObject({ status: "done", role: "Data Analyst", summary: { total: 4, answered: 1, skipped: 1 }, progress: null, sessionsForJob: 1 });
    expect(r.report.keptUntil - r.report.at).toBe(180 * 864e5);
    expect(await answerPrepared(id, "a_bit")).toEqual({ ok: true });
    expect((await getReport(id)).ok && ((await getReport(id)) as { report: { prepared: string } }).report.prepared).toBe("a_bit");
  });
});

describe("the month's sessions", () => {
  it("stop at 20; the home and the setup say how many are left", async () => {
    const c = await cv();
    const j = await job();
    for (let i = 0; i < 20; i++) expect(await start(j.id, c.id)).toMatchObject({ ok: true });
    expect(await start(j.id, c.id)).toEqual({ ok: false, message: "You’ve used your 20 sessions this month." });
    expect(await getSetup(j.id)).toMatchObject({ ok: true, setup: { used: 20, limit: 20, sessions: 20 } });
    // last month's sessions don't count
    await db.update(interviewSessions).set({ createdAt: new Date(Date.now() - 40 * 864e5) });
    expect(await start(j.id, c.id)).toMatchObject({ ok: true });
  });

  it("asks the same job in other words each time", async () => {
    const c = await cv();
    const j = await job();
    const a = await start(j.id, c.id);
    const b = await start(j.id, c.id);
    const [pa, pb] = await Promise.all([a, b].map(async (r) => (r.ok ? (await getInterview(r.id)) : r)));
    const qa = pa.ok ? pa.session.questions.map((q) => q.text) : [];
    const qb = pb.ok ? pb.session.questions.map((q) => q.text) : [];
    expect(qa).not.toEqual(qb);
  });
});

describe("“Practice these again”", () => {
  it("starts a 10-minute session with the questions to practise first, from this one", async () => {
    const { id } = await started();
    const v = await getInterview(id);
    if (!v.ok) throw new Error(v.message);
    // a vague answer to a question about a line with numbers: the report says "Say the result in numbers"
    const q = v.session.questions[0];
    await answerQuestion(id, { questionId: q.id, answer: "I did a lot of work on it.", seconds: 10, secondsUsed: 10 });
    await endInterview(id, 20);
    const r = await getReport(id);
    if (!r.ok) throw new Error(r.message);
    expect(r.report.summary.focus.length).toBeGreaterThan(0);
    const again = await practiceAgain(id);
    if (!again.ok) throw new Error(again.message);
    const [row] = await db.select().from(interviewSessions).where(eq(interviewSessions.id, again.id));
    expect(row).toMatchObject({ fromSessionId: id, minutes: 10, kind: "technical", mode: "typing" });
    expect(row.pack.questions[0].bullet.ref).toBe(r.report.summary.focus[0].ref);
    // the report now has a job's progress: two sessions
    const second = await getReport(again.id);
    expect(second.ok && second.report.sessionsForJob).toBe(2);
  });
});

describe("the home page", () => {
  it("shows the jobs in Interview with their practice, the other jobs, and the past sessions", async () => {
    const c = await cv();
    const j = await job();
    await db.insert(applicationEvents).values({ applicationId: j.id, ownerId: "u1", kind: "status_changed", fromStatus: "applied", toStatus: "interview", at: new Date("2026-11-02T09:00:00Z") });
    await job("u1", { role: "BI Analyst", company: "Northfield Group", status: "saved", url: "https://jobs.example/bi" });
    await job("u1", { role: "Archived", company: "Old", status: "applied", archivedAt: new Date(), url: "https://jobs.example/old" });
    const s = await start(j.id, c.id);
    if (!s.ok) throw new Error(s.message);
    const v = await getInterview(s.id);
    const q = v.ok ? v.session.questions.find((x) => x.requirement?.includes("Power BI")) : undefined;
    await answerQuestion(s.id, { questionId: q!.id, answer: "I built Power BI dashboards that 40 operations staff used daily.", seconds: 30, secondsUsed: 30 });
    await endInterview(s.id, 40);
    // a session opened and left isn't practice
    await start(j.id, c.id);

    const h = await getTrainerHome();
    if (!h.ok) throw new Error(h.message);
    expect(h.home).toMatchObject({ used: 2, limit: 20, hasCv: true });
    expect(h.home.interviews).toEqual([expect.objectContaining({
      id: j.id, since: Date.parse("2026-11-02T09:00:00Z"), required: { met: 3, total: 4 }, practised: 1, lastReportId: s.id,
      proven: ["Power BI"], notYet: ["SQL", "Python", "Snowflake"],
    })]);
    expect(h.home.others.map((o) => o.role)).toEqual(["BI Analyst"]);
    expect(h.home.past).toHaveLength(2);
    expect(await getPracticeCounts()).toEqual({ ok: true, counts: { [j.id]: 1 } });
  });
});

describe("one person's data", () => {
  it("nobody reaches another person's job, CV or session", async () => {
    const { c, j, id } = await started();
    holder.owner = "u2";
    const mine = await cv("u2");
    expect(await getSetup(j.id)).toEqual({ ok: false, message: "This job isn’t in your Tracker." });
    expect(await start(j.id, mine.id)).toEqual({ ok: false, message: "This job isn’t in your Tracker." });
    const theirs = await job("u2");
    expect(await start(theirs.id, c.id)).toEqual({ ok: false, message: "Make a CV in ATS Hero first: the questions come from its lines." });
    const gone = { ok: false, message: "We couldn’t find this interview. It may have been deleted." };
    expect(await getInterview(id)).toEqual(gone);
    expect(await answerQuestion(id, { questionId: "q1", answer: "Hi", seconds: 1, secondsUsed: 1 })).toEqual(gone);
    expect(await getReport(id)).toEqual(gone);
    expect(await deleteInterview(id)).toEqual(gone);
    expect(await practiceAgain(id)).toEqual(gone);
    expect(await getTrainerHome()).toMatchObject({ ok: true, home: { past: [], interviews: [expect.objectContaining({ id: theirs.id, practised: 0 })] } });
  });

  it("deleting a session takes its answers; the job stays", async () => {
    const { j, id } = await started();
    await answerQuestion(id, { questionId: "q1", answer: "An answer", seconds: 5, secondsUsed: 5 });
    expect(await deleteInterview(id)).toEqual({ ok: true });
    expect(await getInterview(id)).toMatchObject({ ok: false });
    expect(await db.select().from(applications).where(eq(applications.id, j.id))).toHaveLength(1);
  });
});
