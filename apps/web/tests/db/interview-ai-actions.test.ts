// Interview Trainer, step 5: the actions with the model, on the real migrations (PGlite) and a fake
// model. A session has the model only when it is on and the person agreed; follow-ups wait on the
// session in the server's words; the feedback is made once and kept; and whenever the model can't be
// asked, the session goes on as it does without AI. Synthetic persona, no network.
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { makeTestDb } from "./setup";
import { aiConsents, aiUsage, applications, cvs, interviewSessions, interviewTurns } from "@/db/schema";
import { AiError, type ModelRequest, type TextModel } from "@/lib/interview/model";
import type { AiSetup } from "@/lib/interview/provider";
import type { FeedbackOutput } from "@/lib/interview/feedback";
import type { CvData } from "@/lib/types";

const holder = vi.hoisted(() => ({
  db: null as unknown, owner: null as string | null,
  ai: { ready: false, why: "off" } as unknown, model: null as unknown,
}));
vi.mock("@/db", () => ({
  get db() {
    return holder.db;
  },
}));
vi.mock("@/app/actions/_shared", () => ({ getOwnerId: async () => holder.owner }));
vi.mock("@/lib/interview/provider", async (original) => ({
  ...(await original<typeof import("@/lib/interview/provider")>()),
  interviewAi: () => holder.ai,
  interviewModel: () => holder.model,
}));

import {
  answerFollowUp, answerQuestion, askForFollowUp, dismissEnglishNote, endInterview, getFeedback, getInterview, getReport, getSetup,
  getTrainerHome, practiceAgain, skipFollowUp, skipQuestion, startInterview,
} from "@/app/actions/interview";
import { INTERVIEW_CONSENT } from "@/lib/ai/consent";
import { usageKey } from "@/lib/interview/budget";

const personas = JSON.parse(fs.readFileSync(path.join(process.cwd(), "../../tools/ats-lab/fixtures/personas.json"), "utf8")) as Record<string, CvData>;
const POST = "Data Analyst\nRequirements:\n- SQL\n- Python\n- Power BI\n- Snowflake\nNice to have: Tableau";

// q2 of the technical pack: "Let's talk about Python. Walk me through when you automated a weekly
// reconciliation workflow in Python, saving 12 hours per week. How did you approach it?"
const WEAK =
  "So the reconciliation took me a lot of time every week. I wrote some Python to pull the data from the bank export and the ledger. " +
  "Then I make it run by itself every Monday. Basically I helped the team a lot with this, and they were happy.";
const FOLLOW = "What changed for the finance team once it ran by itself?";
const MORE = "They stopped checking the rows by hand, and it saved about 12 hours every week.";
const FEEDBACK: FeedbackOutput = {
  situation: { met: true, quote: "the reconciliation took me a lot of time every week" },
  task: { met: false, quote: null },
  action: { met: true, quote: "I wrote some Python to pull the data from the bank export and the ledger." },
  result: { met: true, quote: "it saved about 12 hours every week" },
  vague: [{ phrase: "I helped the team a lot with this", ask: "Who in the team used it, and what did they stop doing by hand?" }],
  english: [
    { quote: "Then I make it run", better: "Then I made it run", kind: "tense", why: "The story is in the past." },
    { quote: "took me a lot of time", better: "took a lot of my time", kind: "word_order", why: "The usual order." },
  ],
  stronger:
    "At Flutterwave, the weekly reconciliation took me a lot of time every week. I automated it: I wrote some Python that pulls the data from the " +
    "bank export and the ledger, and it runs by itself every Monday. It saves about 12 hours every week, and the team stopped checking the rows by hand.",
};

/** A model that answers each task with what the test set for it; an Error is thrown. */
function fakeModel() {
  const requests: ModelRequest[] = [];
  const replies: { followUp: unknown[]; feedback: unknown[] } = { followUp: [{ ask: FOLLOW }], feedback: [FEEDBACK] };
  const model: TextModel = {
    id: "fake:model",
    async generate(req) {
      requests.push(req);
      const list = req.task === "interview-follow-up" ? replies.followUp : replies.feedback;
      const mine = requests.filter((r) => r.task === req.task).length;
      const next = list[Math.min(mine, list.length) - 1];
      if (next instanceof Error) throw next;
      return { object: next };
    },
  };
  const calls = (task: string) => requests.filter((r) => r.task === task);
  return { model, requests, replies, calls };
}

let db: Awaited<ReturnType<typeof makeTestDb>>;
let fake: ReturnType<typeof fakeModel>;
const ON: AiSetup = { ready: true, provider: "anthropic", modelId: "fake" };

beforeEach(async () => {
  db = await makeTestDb();
  holder.db = db;
  holder.owner = "u1";
  fake = fakeModel();
  holder.ai = ON;
  holder.model = fake.model;
  vi.stubEnv("NEXT_PUBLIC_INTERVIEW_TRAINER_ENABLED", "true");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function cv(ownerId = "u1") {
  const [row] = await db.insert(cvs).values({ ownerId, title: "Data Analyst CV", data: personas.amara }).returning();
  return row;
}
async function job(ownerId = "u1") {
  const [row] = await db.insert(applications).values({ ownerId, company: "Altamira Tech", role: "Data Analyst", status: "interview", description: POST }).returning();
  return row;
}
type Start = Partial<Parameters<typeof startInterview>[0]>;
async function started(o: Start = { consent: true }) {
  const c = await cv();
  const j = await job();
  const r = await startInterview({ applicationId: j.id, cvId: c.id, kind: "technical", minutes: 10, feedbackWhen: "each", timer: false, ...o });
  if (!r.ok) throw new Error(r.message);
  return { c, j, id: r.id };
}
const sessionRow = async (id: string) => (await db.select().from(interviewSessions).where(eq(interviewSessions.id, id)))[0];
const answer = (id: string, text = WEAK, questionId = "q2") => answerQuestion(id, { questionId, answer: text, seconds: 60, secondsUsed: 60 });
/** The value of an action that must succeed. */
function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error((r as unknown as { message: string }).message);
  return r as Extract<T, { ok: true }>;
}

describe("a session has the model only when it is on and the person agreed", () => {
  it("tells Setup and the home page whether the interviewer can be the model, and who gets the answers", async () => {
    const j = await job();
    await cv();
    expect(ok(await getSetup(j.id)).setup).toMatchObject({ ai: { agreed: false, provider: "Anthropic (development only)", name: "Anthropic" }, lastStyle: null });
    expect(ok(await getTrainerHome()).home.ai).toBe(true);
    holder.ai = { ready: false, why: "off" };
    expect(ok(await getSetup(j.id)).setup).toMatchObject({ ai: null, lastStyle: null });
    expect(ok(await getTrainerHome()).home.ai).toBe(false);
  });

  it("starts with the model, in the style chosen, and keeps the agreement", async () => {
    const { id, j } = await started({ consent: true, style: "tough", englishNotes: false });
    expect(await sessionRow(id)).toMatchObject({ ai: true, style: "tough", englishNotes: false, mode: "typing" });
    expect((await db.select().from(aiConsents)).map((r) => [r.ownerId, r.version])).toEqual([["u1", INTERVIEW_CONSENT]]);
    // next time Setup doesn't ask, and starts from the last style
    expect(ok(await getSetup(j.id)).setup).toMatchObject({ ai: { agreed: true }, lastStyle: "tough" });
    const c2 = await cv();
    const again = ok(await startInterview({ applicationId: j.id, cvId: c2.id, kind: "manager", minutes: 10, feedbackWhen: "each", timer: false }));
    expect(await sessionRow(again.id)).toMatchObject({ ai: true, style: "friendly", englishNotes: true });
  });

  it("starts without it when the person didn't agree, whatever else was sent", async () => {
    const { id } = await started({ style: "tough", englishNotes: true });
    expect(await sessionRow(id)).toMatchObject({ ai: false, style: "friendly", englishNotes: false });
    expect(await db.select().from(aiConsents)).toHaveLength(0);
    const r = ok(await answer(id));
    expect(r.mayFollowUp).toBe(false);
    expect(ok(await askForFollowUp(id)).followUp).toBeNull();
    expect(ok(await getFeedback(id, r.turn.id))).toMatchObject({ ai: "none", turn: { ai: null } });
    expect(fake.requests).toHaveLength(0);
    expect(ok(await getInterview(id)).session).toMatchObject({ ai: false, opening: null, pending: null });
  });

  it("starts without it when it is off, and keeps no agreement for nothing", async () => {
    holder.ai = { ready: false, why: "off" };
    holder.model = null;
    const { id } = await started({ consent: true, style: "neutral" });
    expect(await sessionRow(id)).toMatchObject({ ai: false, style: "friendly", englishNotes: false });
    expect(await db.select().from(aiConsents)).toHaveLength(0);
  });

  it("opens by saying it is an AI, with the first name from the CV and the job from the Tracker", async () => {
    const { id } = await started();
    expect(ok(await getInterview(id)).session.opening)
      .toBe("Hi Amara, I’m an AI interviewer, not a person. I’ll ask you about the Data Analyst role at Altamira Tech. Ready when you are.");
  });
});

describe("follow-ups", () => {
  it("asks one on the answer, keeps it on the session in the server's words, and makes it a turn when answered", async () => {
    const { id } = await started({ consent: true, style: "neutral" });
    const first = ok(await answer(id));
    // the answer names the line's tool and its subject, not its number
    expect(first).toMatchObject({ mayFollowUp: true, turn: { follow: [], used: ["Reconciliation", "Python"], unused: ["12"], numbers: "12 hours", ai: null } });
    // storing the answer asked no model
    expect(fake.requests).toHaveLength(0);

    const asked = ok(await askForFollowUp(id));
    expect(asked.followUp).toEqual({ questionId: "q2", n: 1, text: FOLLOW });
    expect(fake.calls("interview-follow-up")).toHaveLength(1);
    expect(fake.requests[0].prompt).toContain("CANDIDATE: So the reconciliation took me a lot of time every week.");
    expect(fake.requests[0].prompt).toContain("Style: neutral.");
    expect(fake.requests[0].prompt).toContain("Line: Automated a weekly reconciliation workflow in Python, saving 12 hours per week.");
    // asking again returns the one that waits, without another run
    expect(ok(await askForFollowUp(id)).followUp).toEqual(asked.followUp);
    expect(fake.calls("interview-follow-up")).toHaveLength(1);
    expect(ok(await getInterview(id)).session.pending).toEqual(asked.followUp);

    const second = ok(await answerFollowUp(id, { answer: MORE, seconds: 30, secondsUsed: 95 }));
    expect(second.turn.id).toBe(first.turn.id);
    expect(second.turn.follow).toEqual([{ question: FOLLOW, answer: MORE }]);
    // what the two answers measured together: the CV's number came in the follow-up
    expect(second.turn).toMatchObject({ seconds: 90, used: ["Reconciliation", "Python", "12"], unused: [], numbers: null });
    expect(second.turn.criteria).toContainEqual({ key: "proof", met: true, quote: MORE });
    // Neutral asks up to two
    expect(second.mayFollowUp).toBe(true);
    expect(await sessionRow(id)).toMatchObject({ pending: null, status: "live" });
    const rows = await db.select().from(interviewTurns).where(eq(interviewTurns.sessionId, id));
    expect(rows.map((t) => [t.position, t.kind, t.questionId, t.question === FOLLOW])).toEqual([[1, "question", "q2", false], [2, "follow_up", "q2", true]]);
  });

  it("asks as many as the style allows, and no more", async () => {
    const friendly = await started({ consent: true, style: "friendly" });
    ok(await answer(friendly.id));
    ok(await askForFollowUp(friendly.id));
    expect(ok(await answerFollowUp(friendly.id, { answer: MORE, seconds: 30, secondsUsed: 90 })).mayFollowUp).toBe(false);
    expect(ok(await askForFollowUp(friendly.id)).followUp).toBeNull();
    expect(fake.calls("interview-follow-up")).toHaveLength(1);
  });

  it("moves on when the model says so, when the checks refuse its question, or when it can't be reached", async () => {
    const { id } = await started();
    ok(await answer(id));
    fake.replies.followUp = [{ ask: null }];
    expect(ok(await askForFollowUp(id)).followUp).toBeNull();

    fake.replies.followUp = [{ ask: "Why were you on sick leave?" }, { ask: "How did your illness affect the project?" }];
    expect(ok(await askForFollowUp(id)).followUp).toBeNull();
    expect(fake.calls("interview-follow-up")).toHaveLength(3);

    fake.replies.followUp = [{ ask: null }, { ask: null }, { ask: null }, new AiError("ai.timeout", "interview-follow-up")];
    expect(await askForFollowUp(id)).toEqual({ ok: true, followUp: null });
    expect(await sessionRow(id)).toMatchObject({ pending: null, status: "live" });
    // the interview goes on: the next question takes its answer
    expect((await answer(id, "I would start from SQL, which I know well.", "q3")).ok).toBe(true);
  });

  it("asks none after a skipped question, when the time is up, or for somebody else's session", async () => {
    const { id } = await started();
    ok(await skipQuestion(id, { questionId: "q1", secondsUsed: 10 }));
    expect(ok(await askForFollowUp(id)).followUp).toBeNull();

    const late = ok(await answerQuestion(id, { questionId: "q2", answer: WEAK, seconds: 60, secondsUsed: 0 }));
    await db.update(interviewSessions).set({ secondsUsed: 600 }).where(eq(interviewSessions.id, id));
    expect(late.mayFollowUp).toBe(true);
    expect(ok(await askForFollowUp(id)).followUp).toBeNull();
    expect(fake.requests).toHaveLength(0);

    holder.owner = "u2";
    expect(await askForFollowUp(id)).toMatchObject({ ok: false });
    expect(await answerFollowUp(id, { answer: "x", seconds: 1, secondsUsed: 1 })).toMatchObject({ ok: false });
  });

  it("stops asking the model when the day's runs are used up, and the session goes on", async () => {
    vi.stubEnv("AI_INTERVIEW_DAILY_LIMIT", "1");
    const { id } = await started({ consent: true, style: "tough" });
    ok(await answer(id));
    expect(ok(await askForFollowUp(id)).followUp).not.toBeNull();
    ok(await answerFollowUp(id, { answer: MORE, seconds: 30, secondsUsed: 90 }));
    expect(ok(await askForFollowUp(id)).followUp).toBeNull();
    expect(fake.requests).toHaveLength(1);
    expect((await db.select().from(aiUsage).where(eq(aiUsage.ownerId, usageKey("u1"))))[0].count).toBe(2);
    const turn = ok(await getInterview(id)).session.turns[0];
    expect(ok(await getFeedback(id, turn.id))).toMatchObject({ ai: "unavailable", turn: { ai: null } });
  });

  it("takes a skip of the follow-up as the end of that question", async () => {
    const { id } = await started({ consent: true, style: "tough" });
    ok(await answer(id));
    ok(await askForFollowUp(id));
    const skipped = ok(await skipFollowUp(id, { secondsUsed: 70 }));
    expect(skipped.turn.follow).toEqual([{ question: FOLLOW, answer: null }]);
    expect(ok(await askForFollowUp(id)).followUp).toBeNull();
    expect(await skipFollowUp(id, { secondsUsed: 70 })).toEqual({ ok: false, message: "There’s no follow-up question to answer. Go on to the next question." });
    expect(await answerFollowUp(id, { answer: MORE, seconds: 1, secondsUsed: 71 })).toEqual({ ok: false, message: "There’s no follow-up question to answer. Go on to the next question." });
  });

  it("drops a follow-up that waits when the next answer comes instead, or when the interview ends", async () => {
    const { id } = await started();
    ok(await answer(id));
    ok(await askForFollowUp(id));
    ok(await answer(id, "I would start from SQL, which I know well.", "q3"));
    expect((await sessionRow(id)).pending).toBeNull();
    ok(await askForFollowUp(id));
    expect((await sessionRow(id)).pending).not.toBeNull();
    ok(await endInterview(id, 200));
    expect(await sessionRow(id)).toMatchObject({ status: "done", pending: null });
    expect(ok(await askForFollowUp(id)).followUp).toBeNull();
  });

  it("needs words for a follow-up's answer, like any answer", async () => {
    const { id } = await started();
    ok(await answer(id));
    ok(await askForFollowUp(id));
    expect(await answerFollowUp(id, { answer: "   ", seconds: 1, secondsUsed: 61 })).toEqual({ ok: false, message: "Type your answer first, or skip the question." });
    expect(await answerFollowUp(id, { answer: "x".repeat(6001), seconds: 1, secondsUsed: 61 })).toEqual({ ok: false, message: "Keep your answer under 6,000 characters." });
    expect((await sessionRow(id)).pending).not.toBeNull();
  });
});

describe("the model's feedback", () => {
  async function answeredWithFollowUp(o: Start = { consent: true, style: "friendly" }) {
    const s = await started(o);
    const first = ok(await answer(s.id));
    ok(await askForFollowUp(s.id));
    ok(await answerFollowUp(s.id, { answer: MORE, seconds: 30, secondsUsed: 90 }));
    return { ...s, turnId: first.turn.id };
  }

  it("is made once from the question's answers, checked, kept, and returned again without another run", async () => {
    const { id, turnId } = await answeredWithFollowUp();
    const r = ok(await getFeedback(id, turnId));
    expect(r.ai).toBe("ready");
    expect(r.turn.ai).toEqual({
      criteria: [
        { key: "situation", met: true, quote: "the reconciliation took me a lot of time every week" },
        { key: "task", met: false, quote: null },
        { key: "action", met: true, quote: "I wrote some Python to pull the data from the bank export and the ledger." },
        { key: "result", met: true, quote: "it saved about 12 hours every week" },
      ],
      vague: [{ phrase: "I helped the team a lot with this", ask: "Who in the team used it, and what did they stop doing by hand?" }],
      english: [
        { index: 0, quote: "Then I make it run", better: "Then I made it run", why: "The story is in the past.", kind: "tense" },
        { index: 1, quote: "took me a lot of time", better: "took a lot of my time", why: "The usual order.", kind: "word_order" },
      ],
      dismissed: 0,
      stronger: FEEDBACK.stronger,
      strongerRefused: false,
    });
    const sent = fake.calls("interview-feedback")[0].prompt;
    expect(sent).toContain("English notes: on.");
    expect(sent).toContain("Job: Data Analyst at Flutterwave");
    expect(sent).toContain(`INTERVIEWER: ${FOLLOW}`);
    expect(sent).toContain(`CANDIDATE: ${MORE}`);
    // the rest of the CV and the person's name and contact details stay here
    expect(fake.requests.map((q) => q.prompt + q.instructions).join("\n")).not.toMatch(/Amara|Okafor|@example|\+234|MTN|churn/);

    expect(ok(await getFeedback(id, turnId)).turn.ai).toEqual(r.turn.ai);
    expect(fake.calls("interview-feedback")).toHaveLength(1);
    const [row] = await db.select().from(interviewTurns).where(eq(interviewTurns.id, turnId));
    expect(row.feedback?.prompt).toBe("interview-feedback.v1");
    expect(row.better).toBe(FEEDBACK.stronger);
    // read once, the question takes no more follow-ups
    expect(ok(await askForFollowUp(id)).followUp).toBeNull();
  });

  it("keeps a refused stronger answer out, and says it was refused", async () => {
    fake.replies.feedback = [{ ...FEEDBACK, stronger: "At Flutterwave I automated the weekly reconciliation in Python and Airflow, which cut the work by 40% for the whole team." }];
    const { id, turnId } = await answeredWithFollowUp();
    const r = ok(await getFeedback(id, turnId));
    expect(fake.calls("interview-feedback")).toHaveLength(2);
    expect(r.turn.ai).toMatchObject({ stronger: null, strongerRefused: true });
    expect(r.turn.ai?.criteria).toHaveLength(4);
  });

  it("gives no English notes when the person turned them off", async () => {
    const { id, turnId } = await answeredWithFollowUp({ consent: true, englishNotes: false });
    const r = ok(await getFeedback(id, turnId));
    expect(fake.calls("interview-feedback")[0].prompt).toContain("English notes: off.");
    expect(r.turn.ai?.english).toEqual([]);
  });

  it("waits for the follow-up to be answered: a try is read when it is whole", async () => {
    const { id } = await started();
    const first = ok(await answer(id));
    ok(await askForFollowUp(id));
    expect(await getFeedback(id, first.turn.id)).toEqual({ ok: false, message: "Answer the follow-up question first, or skip it." });
    expect(fake.calls("interview-feedback")).toHaveLength(0);
  });

  it("says when the model can't be asked, keeps nothing, and makes it later", async () => {
    const { id, turnId } = await answeredWithFollowUp();
    fake.replies.feedback = [new AiError("ai.provider", "interview-feedback", 503)];
    const down = ok(await getFeedback(id, turnId));
    expect(down).toMatchObject({ ai: "unavailable", turn: { ai: null, used: ["Reconciliation", "Python", "12"] } });
    expect((await db.select().from(interviewTurns).where(eq(interviewTurns.id, turnId)))[0].feedback).toBeNull();

    // out of shape twice is the same to the person: no feedback now
    fake.replies.feedback = [new AiError("ai.provider", "interview-feedback", 503), { score: 7 }, { score: 8 }];
    expect(ok(await getFeedback(id, turnId)).ai).toBe("unavailable");

    holder.model = null;
    expect(ok(await getFeedback(id, turnId)).ai).toBe("unavailable");

    holder.model = fake.model;
    fake.replies.feedback = [new AiError("ai.provider", "interview-feedback", 503), { score: 7 }, { score: 8 }, FEEDBACK];
    expect(ok(await getFeedback(id, turnId))).toMatchObject({ ai: "ready", turn: { ai: { strongerRefused: false } } });
  });

  it("gives none on a skipped question, and none to somebody else", async () => {
    const { id } = await started();
    const skipped = ok(await skipQuestion(id, { questionId: "q1", secondsUsed: 5 }));
    expect(ok(await getFeedback(id, skipped.turn.id))).toMatchObject({ ai: "none", turn: { ai: null } });
    const mine = ok(await answer(id));
    holder.owner = "u2";
    expect(await getFeedback(id, mine.turn.id)).toMatchObject({ ok: false });
    holder.owner = "u1";
    expect(await getFeedback(id, "no-such-turn")).toEqual({ ok: false, message: "That answer isn’t in this interview." });
    expect(fake.calls("interview-feedback")).toHaveLength(0);
  });

  it("“I said it right” takes a note off the screen and out of the counts, and keeps only its place", async () => {
    const { id, turnId } = await answeredWithFollowUp();
    ok(await getFeedback(id, turnId));
    const r = ok(await dismissEnglishNote(id, { turnId, index: 0 }));
    expect(r.turn.ai?.english).toEqual([{ index: 1, quote: "took me a lot of time", better: "took a lot of my time", why: "The usual order.", kind: "word_order" }]);
    expect(r.turn.ai?.dismissed).toBe(1);
    const [row] = await db.select().from(interviewTurns).where(eq(interviewTurns.id, turnId));
    expect(row.dismissed).toEqual([0]);
    expect(row.feedback?.english).toHaveLength(2);
    expect(await dismissEnglishNote(id, { turnId, index: 5 })).toEqual({ ok: false, message: "We couldn’t find that note." });
    holder.owner = "u2";
    expect(await dismissEnglishNote(id, { turnId, index: 1 })).toMatchObject({ ok: false });
  });
});

describe("the report of a session with the model", () => {
  it("has each question's follow-ups, what its answers measured together, and the model's feedback", async () => {
    const { id } = await started({ consent: true, style: "friendly" });
    const first = ok(await answer(id));
    ok(await askForFollowUp(id));
    ok(await answerFollowUp(id, { answer: MORE, seconds: 30, secondsUsed: 90 }));
    ok(await getFeedback(id, first.turn.id));
    ok(await endInterview(id, 120));

    const { report } = ok(await getReport(id));
    expect(report).toMatchObject({ ai: true, style: "friendly", englishNotes: true, status: "done" });
    const q2 = report.summary.questions[1];
    expect(q2).toMatchObject({
      state: "answered", turnId: first.turn.id, answer: WEAK, follow: [{ question: FOLLOW, answer: MORE }],
      used: ["Reconciliation", "Python", "12"], named: ["Python"], tries: 1,
    });
    expect(q2.ai?.criteria.map((c) => [c.key, c.met])).toEqual([["situation", true], ["task", false], ["action", true], ["result", true]]);
    expect(q2.ai?.stronger).toBe(FEEDBACK.stronger);
    expect(report.summary.wentWell).toContain("You said what came of it in your answer.");
    // the vague phrase is something to practise; the CV's number was said, in the follow-up
    expect(report.summary.toPractice).toContainEqual({ n: 2, text: "Make it concrete.", detail: "Question 2: “I helped the team a lot with this”." });
    expect(report.summary.toPractice.map((t) => t.text)).not.toContain("Say the result in numbers.");
    expect(report.summary.english).toEqual({ notes: 2, dismissed: 0, patterns: [] });
  });

  it("counts a kind of English note that came up more than once, without the notes marked right", async () => {
    const { id } = await started({ consent: true, style: "friendly" });
    const tense = (quote: string, better: string) => ({ quote, better, kind: "tense" as const, why: "Past tense." });
    fake.replies.followUp = [{ ask: null }];
    fake.replies.feedback = [
      { ...FEEDBACK, result: { met: false, quote: null }, english: [tense("Then I make it run", "Then I made it run"), tense("they were happy", "they had been happy")] },
      { ...FEEDBACK, situation: { met: false, quote: null }, action: { met: false, quote: null }, result: { met: false, quote: null }, vague: [], stronger: null,
        english: [tense("I use it", "I used it"), { quote: "since two years", better: "for two years", kind: "preposition", why: "A length of time takes “for”." }] },
    ];
    // q2 says the CV's number, and the model still finds no result; q3 leaves its line's "40" out
    const a = ok(await answer(id, `${WEAK} It was 12 hours of work.`));
    ok(await getFeedback(id, a.turn.id));
    const b = ok(await answer(id, "I use it since two years at my job, mostly SQL for the reports.", "q3"));
    ok(await getFeedback(id, b.turn.id));
    ok(await dismissEnglishNote(id, { turnId: a.turn.id, index: 1 }));

    const { summary } = ok(await getReport(id)).report;
    expect(summary.english).toEqual({
      notes: 3, dismissed: 1,
      patterns: [{ kind: "tense", label: "Verb tense", count: 2, example: { quote: "Then I make it run", better: "Then I made it run" } }],
    });
    expect(summary.toPractice).toEqual([
      { n: 3, text: "Say the result in numbers.", detail: "Question 3: “40 operations” is in your CV." },
      { n: 2, text: "Say what came of it.", detail: "Question 2: the answer had no result." },
      { n: null, text: "Keep to the past tense when you tell what happened.", detail: "2 times." },
    ]);
  });

  it("“Practice these again” keeps the model, the style and the notes while the agreement stands and the model is on", async () => {
    const first = await started({ consent: true, style: "tough", englishNotes: false });
    ok(await answer(first.id));
    ok(await endInterview(first.id, 100));
    const again = ok(await practiceAgain(first.id));
    expect(await sessionRow(again.id)).toMatchObject({ ai: true, style: "tough", englishNotes: false, fromSessionId: first.id, minutes: 10 });

    holder.ai = { ready: false, why: "off" };
    const without = ok(await practiceAgain(first.id));
    expect(await sessionRow(without.id)).toMatchObject({ ai: false, style: "friendly", englishNotes: false });
  });
});
