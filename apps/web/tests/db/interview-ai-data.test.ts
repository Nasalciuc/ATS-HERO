// Interview Trainer, step 5, the data (migration 0007 on PGlite): a session knows whether the
// interviewer is the model, and holds the follow-up that waits for an answer; "I said it right" keeps
// a note's place; the agreement to send answers to a model is kept with its text's version; model
// runs are counted per person and for everybody, apart from the rewrite's count; the account takes
// its agreement and its count with it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb } from "./setup";
import { aiConsents, aiUsage, applications, cvs, interviewSessions, interviewTurns, users } from "@/db/schema";
import { emptyCvData, type InterviewFeedback, type InterviewPack } from "@/lib/types";

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
  addFeedback, addTurn, createSession, dismissNote, getSession, setPending, updateSession, type NewSession,
} from "@/lib/interview/store";
import { giveAiConsent, hasAiConsent, INTERVIEW_CONSENT } from "@/lib/ai/consent";
import { ALL_USAGE_KEY, RUNS_PER_DAY, RUNS_PER_DAY_ALL, spendRun, usageKey } from "@/lib/interview/budget";
import { consumeAiQuotaOn } from "@/lib/ai-quota";
import { deleteAccount } from "@/app/actions/users";

const PACK: InterviewPack = {
  questions: [
    { id: "q1", text: "Tell me about the dashboards you built at Altamira.", requirement: "Power BI",
      bullet: { ref: "work.0.0", text: "Built 12 Power BI dashboards for sales" } },
    { id: "q2", text: "How did you cut the monthly report from 6 hours to 1?", requirement: "SQL",
      bullet: { ref: "work.0.1", text: "Cut the monthly report from 6 hours to 1 with SQL" } },
  ],
};
const FEEDBACK: InterviewFeedback = {
  criteria: [{ key: "result", met: true, quote: "from 6 hours to 1" }],
  vague: [],
  english: [
    { quote: "since 2 years", better: "for 2 years", kind: "preposition", why: "A length of time takes “for”." },
    { quote: "I make", better: "I made", kind: "tense" },
  ],
  prompt: "interview-feedback.v1",
};

let db: Awaited<ReturnType<typeof makeTestDb>>;
beforeEach(async () => {
  db = await makeTestDb();
  holder.db = db;
  holder.owner = "u1";
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function jobAndCv(ownerId: string, over: Partial<NewSession> = {}): Promise<NewSession> {
  const [job] = await db.insert(applications).values({ ownerId, company: "Altamira Tech", role: "Data Analyst", status: "interview" }).returning();
  const [cv] = await db.insert(cvs).values({ ownerId, title: "Main CV", data: emptyCvData() }).returning();
  return { applicationId: job.id, cvId: cv.id, kind: "manager", style: "neutral", minutes: 10, mode: "typing", pack: PACK, ...over };
}
const turn = (n: number, kind: "question" | "follow_up" = "question", answer: string | null = "I cut the report from 6 hours to 1 since 2 years.") => ({
  round: 1, kind, questionId: `q${n}`, question: PACK.questions[n - 1].text, requirement: PACK.questions[n - 1].requirement,
  bullet: PACK.questions[n - 1].bullet, answer, answeredBy: answer == null ? null : ("typing" as const),
  measures: answer == null ? null : { seconds: 40, words: 11, wordsPerMinute: 0, longPauses: 0, fillers: [] },
});
const pendingOf = async (id: string) => (await db.select({ pending: interviewSessions.pending }).from(interviewSessions).where(eq(interviewSessions.id, id)))[0].pending;

describe("a session and the model", () => {
  it("is without the model unless it starts with it", async () => {
    const plain = await createSession("u1", await jobAndCv("u1"));
    const withAi = await createSession("u1", await jobAndCv("u1", { ai: true, englishNotes: true, style: "tough" }));
    expect(plain).toMatchObject({ ai: false, pending: null });
    expect(withAi).toMatchObject({ ai: true, style: "tough", englishNotes: true, pending: null });
  });

  it("holds the follow-up that waits, one at a time, and only while it runs", async () => {
    const s = await createSession("u1", await jobAndCv("u1", { ai: true }));
    await addTurn("u1", s.id, turn(1));
    const first = { questionId: "q1", n: 1, text: "Who used the dashboards every day?" };
    expect(await setPending("u2", s.id, first)).toBe(false);
    expect(await setPending("u1", s.id, first)).toBe(true);
    // one waits: another isn't taken
    expect(await setPending("u1", s.id, { questionId: "q1", n: 2, text: "And then?" })).toBe(false);
    expect(await pendingOf(s.id)).toEqual(first);

    await updateSession("u1", s.id, { status: "done" });
    expect(await pendingOf(s.id)).toBeNull();
    expect(await setPending("u1", s.id, first)).toBe(false);
  });

  it("turns the waiting follow-up into a turn, in the words it was asked in", async () => {
    const s = await createSession("u1", await jobAndCv("u1", { ai: true }));
    await addTurn("u1", s.id, turn(1));
    // nothing waits: there is no follow-up to answer
    await expect(addTurn("u1", s.id, turn(1, "follow_up"))).rejects.toThrow("No follow-up is waiting for an answer");

    await setPending("u1", s.id, { questionId: "q1", n: 1, text: "Who used the dashboards every day?" });
    // it waits for q1, not for q2
    await expect(addTurn("u1", s.id, turn(2, "follow_up"))).rejects.toThrow("No follow-up is waiting for an answer");
    const answered = await addTurn("u1", s.id, { ...turn(1, "follow_up", "The sales managers, every morning."), question: "Something the browser sent" });
    expect(answered).toMatchObject({ position: 2, kind: "follow_up", questionId: "q1", question: "Who used the dashboards every day?", answer: "The sales managers, every morning." });
    expect(await pendingOf(s.id)).toBeNull();
    // answered once
    await expect(addTurn("u1", s.id, turn(1, "follow_up"))).rejects.toThrow("No follow-up is waiting for an answer");

    // skipped: a turn with no answer
    await setPending("u1", s.id, { questionId: "q1", n: 2, text: "How many of them?" });
    expect(await addTurn("u1", s.id, turn(1, "follow_up", null))).toMatchObject({ position: 3, kind: "follow_up", question: "How many of them?", answer: null });
  });

  it("drops a waiting follow-up when the next question's answer comes instead", async () => {
    const s = await createSession("u1", await jobAndCv("u1", { ai: true }));
    await addTurn("u1", s.id, turn(1));
    await setPending("u1", s.id, { questionId: "q1", n: 1, text: "Who used the dashboards every day?" });
    await addTurn("u1", s.id, turn(2));
    expect(await pendingOf(s.id)).toBeNull();
    const found = await getSession("u1", s.id);
    expect(found?.turns.map((t) => [t.kind, t.questionId])).toEqual([["question", "q1"], ["question", "q2"]]);
  });
});

describe("“I said it right”", () => {
  it("keeps the note's place on the turn, once, and leaves the feedback as it was", async () => {
    const s = await createSession("u1", await jobAndCv("u1", { ai: true }));
    const t = await addTurn("u1", s.id, turn(1));
    // no feedback yet: nothing to mark
    expect(await dismissNote("u1", t.id, 0)).toBe(false);
    await addFeedback("u1", t.id, FEEDBACK, "A stronger answer.");

    expect(await dismissNote("u2", t.id, 1)).toBe(false);
    expect(await dismissNote("u1", t.id, 2)).toBe(false);
    expect(await dismissNote("u1", t.id, -1)).toBe(false);
    expect(await dismissNote("u1", t.id, 0.5)).toBe(false);
    expect(await dismissNote("u1", t.id, 1)).toBe(true);
    expect(await dismissNote("u1", t.id, 1)).toBe(true);
    expect(await dismissNote("u1", t.id, 0)).toBe(true);
    const [row] = await db.select().from(interviewTurns).where(eq(interviewTurns.id, t.id));
    expect(row.dismissed).toEqual([0, 1]);
    expect(row.feedback).toEqual(FEEDBACK);
    expect(row.better).toBe("A stronger answer.");
    expect(JSON.stringify(row.dismissed)).not.toMatch(/since|make/);
  });
});

describe("the agreement to send answers to a model", () => {
  it("is the owner's, for one version of the text", async () => {
    expect(INTERVIEW_CONSENT).toBe("interview.v1");
    expect(await hasAiConsent("u1", INTERVIEW_CONSENT)).toBe(false);
    await giveAiConsent("u1", INTERVIEW_CONSENT);
    expect(await hasAiConsent("u1", INTERVIEW_CONSENT)).toBe(true);
    expect(await hasAiConsent("u2", INTERVIEW_CONSENT)).toBe(false);
    // another text asks again
    expect(await hasAiConsent("u1", "interview.v2")).toBe(false);
  });

  it("keeps the first date when given twice", async () => {
    await giveAiConsent("u1", INTERVIEW_CONSENT);
    const then = new Date("2026-11-01T10:00:00Z");
    await db.update(aiConsents).set({ acceptedAt: then }).where(eq(aiConsents.ownerId, "u1"));
    await giveAiConsent("u1", INTERVIEW_CONSENT);
    const rows = await db.select().from(aiConsents);
    expect(rows).toHaveLength(1);
    expect(rows[0].acceptedAt.toISOString()).toBe(then.toISOString());
  });
});

describe("model runs a day", () => {
  const today = new Date().toISOString().slice(0, 10);
  const count = async (key: string) => (await db.select().from(aiUsage).where(eq(aiUsage.ownerId, key)))[0]?.count ?? 0;

  it("counts each run for the person and for everybody, apart from the rewrite's count", async () => {
    expect(await spendRun("u1")).toBe(true);
    expect(await spendRun("u1")).toBe(true);
    expect(await spendRun("u2")).toBe(true);
    expect(await count(usageKey("u1"))).toBe(2);
    expect(await count(usageKey("u2"))).toBe(1);
    expect(await count(ALL_USAGE_KEY)).toBe(3);
    // the rewrite counts under the bare owner id: the two don't use each other up
    expect(await consumeAiQuotaOn(db, "u1", 5)).toBe(4);
    expect(await count("u1")).toBe(1);
    expect(await count(usageKey("u1"))).toBe(2);
    expect((await db.select().from(aiUsage)).every((r) => r.day === today)).toBe(true);
    expect([RUNS_PER_DAY, RUNS_PER_DAY_ALL]).toEqual([200, 5000]);
  });

  it("stops at the person's limit without using up everybody's", async () => {
    vi.stubEnv("AI_INTERVIEW_DAILY_LIMIT", "2");
    expect([await spendRun("u1"), await spendRun("u1"), await spendRun("u1"), await spendRun("u1")]).toEqual([true, true, false, false]);
    expect(await count(ALL_USAGE_KEY)).toBe(2);
    expect(await spendRun("u2")).toBe(true);
  });

  it("stops everybody at the day's ceiling", async () => {
    vi.stubEnv("AI_INTERVIEW_GLOBAL_DAILY_LIMIT", "3");
    expect([await spendRun("u1"), await spendRun("u2"), await spendRun("u3"), await spendRun("u4"), await spendRun("u1")]).toEqual([true, true, true, false, false]);
  });

  it("falls back to the built-in limits when the configured ones aren't numbers", async () => {
    vi.stubEnv("AI_INTERVIEW_DAILY_LIMIT", "lots");
    vi.stubEnv("AI_INTERVIEW_GLOBAL_DAILY_LIMIT", "0");
    expect(await spendRun("u1")).toBe(true);
  });
});

describe("deleting the account", () => {
  it("takes the owner's agreement and their count of runs, and leaves other people's and everybody's", async () => {
    await db.insert(users).values([{ clerkId: "u1", email: "u1@example.com" }, { clerkId: "u2", email: "u2@example.com" }]);
    await giveAiConsent("u1", INTERVIEW_CONSENT);
    await giveAiConsent("u2", INTERVIEW_CONSENT);
    await spendRun("u1");
    await spendRun("u2");
    await consumeAiQuotaOn(db, "u1", 5);

    await deleteAccount();
    expect((await db.select().from(aiConsents)).map((r) => r.ownerId)).toEqual(["u2"]);
    expect((await db.select().from(aiUsage)).map((r) => r.ownerId).sort()).toEqual([ALL_USAGE_KEY, usageKey("u2")].sort());
  });
});
