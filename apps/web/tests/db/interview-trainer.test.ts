// Interview Trainer, data step (ANTRENOR-INTERVIU-VOCE.md §12.7): interview_sessions and interview_turns
// on the real migrations (PGlite). A session is the owner's, for one of their jobs and CVs, every
// question tied to a CV line; a turn's question, answer and measures never change, its feedback is
// added once; a finished session takes no more turns; the session, the job and the account each take
// their sessions with them; the cron deletes sessions older than INTERVIEW_RETENTION_DAYS.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb } from "./setup";
import { applications, cvs, interviewSessions, interviewTurns } from "@/db/schema";
import { emptyCvData, type InterviewFeedback, type InterviewPack } from "@/lib/types";
import { INTERVIEW_RETENTION_DAYS } from "@/lib/retention";

const holder = vi.hoisted(() => ({ db: null as unknown, owner: null as string | null }));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@/app/actions/_shared", () => ({ getOwnerId: async () => holder.owner }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: holder.owner }),
  clerkClient: async () => ({ users: { deleteUser: async () => undefined } }),
}));

import {
  addFeedback, addTurn, createSession, deleteSession, getSession, InterviewError, listSessions, setPending, setPrepared,
  updateSession, type NewSession,
} from "@/lib/interview/store";
import { removeApplication } from "@/app/actions/applications";
import { deleteAccount } from "@/app/actions/users";
import { GET as purge } from "@/app/api/cron/purge-interviews/route";

const DAY = 24 * 60 * 60 * 1000;

const PACK: InterviewPack = {
  questions: [
    { id: "q1", text: "Tell me about the dashboards you built at Altamira.", requirement: "Power BI",
      bullet: { ref: "work.0.highlights.0", text: "Built 12 Power BI dashboards for sales" } },
    { id: "q2", text: "How did you cut the monthly report from 6 hours to 1?", requirement: "SQL",
      bullet: { ref: "work.0.highlights.1", text: "Cut the monthly report from 6 hours to 1 with SQL" } },
  ],
};
const FEEDBACK: InterviewFeedback = {
  criteria: [{ key: "result", met: true, quote: "from 6 hours to 1" }],
  vague: [],
  english: [{ quote: "since 2 years", better: "for 2 years" }],
};

let db: Awaited<ReturnType<typeof makeTestDb>>;
const prevSecret = process.env.CRON_SECRET;

beforeEach(async () => {
  db = await makeTestDb();
  holder.db = db;
  holder.owner = "u1";
  process.env.CRON_SECRET = "test-secret";
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  if (prevSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = prevSecret;
});

/** A job and a CV for an owner, and the input that starts a session on them. */
async function jobAndCv(ownerId: string, over: Partial<NewSession> = {}): Promise<NewSession> {
  const [job] = await db.insert(applications).values({ ownerId, company: "Altamira Tech", role: "Data Analyst", status: "interview" }).returning();
  const [cv] = await db.insert(cvs).values({ ownerId, title: "Main CV", data: emptyCvData() }).returning();
  return { applicationId: job.id, cvId: cv.id, kind: "recruiter", style: "friendly", minutes: 10, mode: "typing", pack: PACK, ...over };
}

const answer = (n: number) => ({
  round: 1, kind: "question" as const, questionId: `q${n}`, question: PACK.questions[n - 1].text,
  requirement: PACK.questions[n - 1].requirement, bullet: PACK.questions[n - 1].bullet,
  answer: "I cut the report from 6 hours to 1 since 2 years.", answeredBy: "typing" as const,
  measures: { seconds: 40, words: 11, wordsPerMinute: 17, longPauses: 0, fillers: [] },
});

describe("interview sessions", () => {
  it("starts with the setup's choices and the defaults: feedback after each answer, no timer, English notes on", async () => {
    const s = await createSession("u1", await jobAndCv("u1"));
    expect(s).toMatchObject({
      ownerId: "u1", kind: "recruiter", style: "friendly", minutes: 10, mode: "typing", feedbackWhen: "each",
      timer: false, englishNotes: true, status: "live", round: 1, secondsUsed: 0, fromSessionId: null, prepared: null, endedAt: null,
    });
    expect(s.pack.questions.map((q) => q.id)).toEqual(["q1", "q2"]);
  });

  it("refuses another owner's job or CV, an empty pack, and a question without a CV line", async () => {
    const theirs = await jobAndCv("u2");
    const mine = await jobAndCv("u1");
    await expect(createSession("u1", { ...mine, applicationId: theirs.applicationId })).rejects.toThrow("Job not found");
    await expect(createSession("u1", { ...mine, cvId: theirs.cvId })).rejects.toThrow("CV not found");
    await expect(createSession("u1", { ...mine, pack: { questions: [] } })).rejects.toThrow(InterviewError);
    const noLine = { questions: [{ ...PACK.questions[0], bullet: { ref: "", text: "" } }] };
    await expect(createSession("u1", { ...mine, pack: noLine })).rejects.toThrow("A question without a CV line");
    expect(await db.select().from(interviewSessions)).toHaveLength(0);
  });

  it("the database refuses a length, a kind or a style the trainer doesn't have", async () => {
    const input = await jobAndCv("u1");
    const row = { ownerId: "u1", applicationId: input.applicationId, cvId: input.cvId, kind: "recruiter" as const,
      style: "friendly" as const, minutes: 10, mode: "voice" as const, pack: PACK };
    await expect(db.insert(interviewSessions).values({ ...row, minutes: 45 })).rejects.toThrow();
    await expect(db.insert(interviewSessions).values({ ...row, kind: "salary" as never })).rejects.toThrow();
    await expect(db.insert(interviewSessions).values({ ...row, style: "rude" as never })).rejects.toThrow();
  });

  it("an owner sees only their own sessions", async () => {
    const mine = await createSession("u1", await jobAndCv("u1"));
    const theirs = await createSession("u2", await jobAndCv("u2"));
    expect((await listSessions("u1")).map((s) => s.id)).toEqual([mine.id]);
    expect(await getSession("u1", theirs.id)).toBeNull();
    await expect(addTurn("u1", theirs.id, answer(1))).rejects.toThrow("Session not found");
    await expect(updateSession("u1", theirs.id, { status: "paused" })).rejects.toThrow(InterviewError);
    expect(await deleteSession("u1", theirs.id)).toBe(false);
    expect(await getSession("u2", theirs.id)).not.toBeNull();
  });

  it("\"Practice these again\" starts only from the owner's own session", async () => {
    const theirs = await createSession("u2", await jobAndCv("u2"));
    await expect(createSession("u1", await jobAndCv("u1", { fromSessionId: theirs.id }))).rejects.toThrow("Session not found");
    const first = await createSession("u1", await jobAndCv("u1"));
    const again = await createSession("u1", await jobAndCv("u1", { fromSessionId: first.id }));
    expect(again.fromSessionId).toBe(first.id);
  });
});

describe("interview turns", () => {
  it("are numbered in order, follow-ups keep their question, and the report reads them in order", async () => {
    const s = await createSession("u1", await jobAndCv("u1"));
    await addTurn("u1", s.id, answer(1));
    // a follow-up is the one the session holds (step 5): the interviewer asks it, then the answer makes it a turn
    await setPending("u1", s.id, { questionId: "q1", n: 1, text: "And what was the result?" });
    await addTurn("u1", s.id, { ...answer(1), kind: "follow_up", answer: "Sales saw it daily." });
    await addTurn("u1", s.id, { ...answer(2), answer: null });   // skipped
    const got = await getSession("u1", s.id);
    expect(got?.turns.map((t) => [t.position, t.kind, t.questionId, t.answer === null])).toEqual([
      [1, "question", "q1", false], [2, "follow_up", "q1", false], [3, "question", "q2", true],
    ]);
  });

  it("two answers at once still take two places", async () => {
    const s = await createSession("u1", await jobAndCv("u1"));
    await Promise.all([addTurn("u1", s.id, answer(1)), addTurn("u1", s.id, answer(2))]);
    const got = await getSession("u1", s.id);
    expect(got?.turns.map((t) => t.position)).toEqual([1, 2]);
  });

  it("get their feedback once: a second write changes nothing, and nobody else can write it", async () => {
    const s = await createSession("u1", await jobAndCv("u1"));
    const t = await addTurn("u1", s.id, answer(2));
    expect(await addFeedback("u2", t.id, FEEDBACK, "x")).toBe(false);
    expect(await addFeedback("u1", t.id, FEEDBACK, "I cut the monthly report from 6 hours to 1 with SQL.")).toBe(true);
    expect(await addFeedback("u1", t.id, { criteria: [], vague: [], english: [] }, "rewritten")).toBe(false);
    const [row] = await db.select().from(interviewTurns).where(eq(interviewTurns.id, t.id));
    expect(row.feedback).toEqual(FEEDBACK);
    expect(row.better).toBe("I cut the monthly report from 6 hours to 1 with SQL.");
    expect(row.answer).toBe("I cut the report from 6 hours to 1 since 2 years.");
  });

  it("a finished session takes no new turn and doesn't go back to live; its time only grows", async () => {
    const s = await createSession("u1", await jobAndCv("u1"));
    await updateSession("u1", s.id, { secondsUsed: 300 });
    expect((await updateSession("u1", s.id, { secondsUsed: 120 })).secondsUsed).toBe(300);
    const done = await updateSession("u1", s.id, { status: "done", secondsUsed: 420 });
    expect(done.status).toBe("done");
    expect(done.endedAt).toBeInstanceOf(Date);
    expect(done.secondsUsed).toBe(420);
    await expect(addTurn("u1", s.id, answer(1))).rejects.toThrow("The session is finished");
    await expect(updateSession("u1", s.id, { status: "live" })).rejects.toThrow(InterviewError);
  });

  it("\"Do you feel more prepared?\" is kept only on a finished session", async () => {
    const s = await createSession("u1", await jobAndCv("u1"));
    expect(await setPrepared("u1", s.id, "yes")).toBe(false);
    await updateSession("u1", s.id, { status: "done" });
    expect(await setPrepared("u2", s.id, "no")).toBe(false);
    expect(await setPrepared("u1", s.id, "a_bit")).toBe(true);
    expect((await getSession("u1", s.id))?.session.prepared).toBe("a_bit");
  });
});

describe("deleting interview practice", () => {
  it("\"Delete this session\" takes its turns and nothing else", async () => {
    const input = await jobAndCv("u1");
    const a = await createSession("u1", input);
    const b = await createSession("u1", input);
    await addTurn("u1", a.id, answer(1));
    await addTurn("u1", b.id, answer(1));
    expect(await deleteSession("u1", a.id)).toBe(true);
    expect((await db.select().from(interviewSessions)).map((s) => s.id)).toEqual([b.id]);
    expect((await db.select().from(interviewTurns)).map((t) => t.sessionId)).toEqual([b.id]);
  });

  it("deleting a job takes the practice for that job, not for the others", async () => {
    const forJob = await jobAndCv("u1");
    const other = await jobAndCv("u1");
    const a = await createSession("u1", forJob);
    const b = await createSession("u1", other);
    await addTurn("u1", a.id, answer(1));
    await addTurn("u1", b.id, answer(1));
    await removeApplication(forJob.applicationId);
    expect((await db.select().from(interviewSessions)).map((s) => s.id)).toEqual([b.id]);
    expect((await db.select().from(interviewTurns)).map((t) => t.sessionId)).toEqual([b.id]);
  });

  it("deleteAccount leaves no session and no turn of the owner, and keeps another owner's", async () => {
    const mine = await createSession("u1", await jobAndCv("u1"));
    const theirs = await createSession("u2", await jobAndCv("u2"));
    await addTurn("u1", mine.id, answer(1));
    await addTurn("u2", theirs.id, answer(1));
    await deleteAccount();
    expect((await db.select().from(interviewSessions)).map((s) => s.ownerId)).toEqual(["u2"]);
    expect((await db.select().from(interviewTurns)).map((t) => t.ownerId)).toEqual(["u2"]);
  });

  it(`the cron deletes sessions started more than ${INTERVIEW_RETENTION_DAYS} days ago, with their turns, and nothing newer`, async () => {
    const input = await jobAndCv("u1");
    const old = await createSession("u1", input);
    const recent = await createSession("u1", input);
    await addTurn("u1", old.id, answer(1));
    await addTurn("u1", recent.id, answer(1));
    await db.update(interviewSessions).set({ createdAt: new Date(Date.now() - (INTERVIEW_RETENTION_DAYS + 1) * DAY) }).where(eq(interviewSessions.id, old.id));
    await db.update(interviewSessions).set({ createdAt: new Date(Date.now() - (INTERVIEW_RETENTION_DAYS - 1) * DAY) }).where(eq(interviewSessions.id, recent.id));

    const denied = await purge(new Request("http://localhost/api/cron/purge-interviews"));
    expect(denied.status).toBe(401);
    expect(await db.select().from(interviewSessions)).toHaveLength(2);

    const res = await purge(new Request("http://localhost/api/cron/purge-interviews", { headers: { authorization: "Bearer test-secret" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ purgedSessions: 1, purgedTurns: 1 });
    expect((await db.select().from(interviewSessions)).map((s) => s.id)).toEqual([recent.id]);
    expect((await db.select().from(interviewTurns)).map((t) => t.sessionId)).toEqual([recent.id]);
    // logged like every other query: the action and the days, nothing of what was said
    const lines = vi.mocked(console.log).mock.calls.map(([line]) => String(line)).filter((line) => line.includes("interview.purge"));
    expect(lines.map((line) => JSON.parse(line))).toEqual([expect.objectContaining({ level: "info", action: "interview.purge", days: INTERVIEW_RETENTION_DAYS })]);
  });
});
