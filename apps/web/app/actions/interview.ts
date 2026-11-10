"use server";
/**
 * Interview Trainer (canvas "ATS Hero Tracker v2", page "Interview trainer"; ANTRENOR-INTERVIU-VOCE.md §12).
 *
 * Typing only, for now; speaking comes with step 6 (ANTRENOR-INTERVIU-CONSTRUCTIE.md). The questions
 * come from the pack (lib/interview/pack.ts), and an answer's feedback starts with what it measured
 * (lib/interview/measure.ts and report.ts), without AI.
 *
 * With the model (step 5) a session's interviewer is an AI: it asks follow-ups on what the person
 * said (follow-up.ts) and gives feedback on each answer (feedback.ts), both checked in code before
 * anyone sees them. A session has the model only when all of these hold at Start: the switch is on
 * and a model is named (provider.ts), and the person agreed to their answers going to it
 * (lib/ai/consent.ts). Otherwise, and whenever the model can't be reached or the day's runs are used
 * up (budget.ts), the session goes on as it does without AI: nothing here fails because of a model.
 * - An answer is stored first, by an action that never waits for a model. Asking for a follow-up or
 *   for the feedback is another action, so a slow or failed model costs no answer.
 * - A follow-up waits on the session, in the server's words, until it is answered or skipped.
 * - The feedback is made once per try and kept; asking again returns what was kept.
 *
 * Each action resolves the owner and filters by them (rule 4): a job, a CV or a session id from the
 * client is used only when it is the owner's. Expected failures come back as { ok: false, message }:
 * Next.js hides a thrown message in production.
 */
import { z } from "zod";
import { and, desc, eq, inArray, isNotNull, max, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  applicationEvents, applications, cvs, interviewSessions, interviewTurns,
  type Application, type InterviewSession, type InterviewTurn,
} from "@/db/schema";
import { getOwnerId } from "./_shared";
import { interviewTrainerEnabled } from "@/lib/features";
import { withLog } from "@/lib/log";
import { jobFit } from "@/lib/job-fit";
import { INTERVIEW_RETENTION_DAYS } from "@/lib/retention";
import { giveAiConsent, hasAiConsent, INTERVIEW_CONSENT } from "@/lib/ai/consent";
import { spendRun } from "@/lib/interview/budget";
import { giveFeedback } from "@/lib/interview/feedback";
import { askFollowUp, FOLLOW_UPS } from "@/lib/interview/follow-up";
import { AiError } from "@/lib/interview/model";
import { askAbout, buildPack, cvLines, lineAt, PackError, theRole, type AskItem, type PackInput } from "@/lib/interview/pack";
import { interviewAi, interviewModel, PROVIDER_LABEL, PROVIDER_NAME } from "@/lib/interview/provider";
import { measureAnswer, measuredCriteria } from "@/lib/interview/measure";
import {
  aiFeedbackOf, answersOf, exchangesOf, measuresOf, numberSpan, progress, PROGRESS_COLUMNS, proofSoFar, requirementsNamed, summarize,
  type AiFeedback, type Exchange, type Progress, type SessionSummary, type TurnLike,
} from "@/lib/interview/report";
import {
  addFeedback, addTurn, countThisMonth, createSession, deleteSession, dismissNote, getSession, INTERVIEW_SESSIONS_PER_MONTH,
  InterviewError, listSessions, setPending, setPrepared, updateSession,
} from "@/lib/interview/store";
import {
  cvToText, emptyCvData, type ApplicationStatus, type CvData, type InterviewCriterion, type InterviewFeedbackWhen,
  type InterviewKind, type InterviewMode, type InterviewPending, type InterviewPrepared, type InterviewStatus, type InterviewStyle,
} from "@/lib/types";

type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };

const OFF = { ok: false as const, message: "The Interview Trainer isn’t available yet." };
const SIGNED_OUT = { ok: false as const, message: "Sign in to practice." };
const FAILED = "Something went wrong. Try again.";
const LIMIT = `You’ve used your ${INTERVIEW_SESSIONS_PER_MONTH} sessions this month.`;
const GONE = "We couldn’t find this interview. It may have been deleted.";
const NO_JOB = "This job isn’t in your Tracker.";
const NO_CV = "Make a CV in ATS Hero first: the questions come from its lines.";
const NO_LINES = "Your CV has no lines to ask about yet. Add your work experience, then practice.";
const ENDED = "This interview has ended.";
const NO_FOLLOW_UP = "There’s no follow-up question to answer. Go on to the next question.";
/** An answer longer than this is a pasted document, not an answer. */
const MAX_ANSWER = 6000;
/** A question takes an answer this many times: the first, then "Try this answer again" twice. */
const MAX_TRIES = 3;

async function owner(): Promise<string | { ok: false; message: string }> {
  if (!interviewTrainerEnabled()) return OFF;
  return (await getOwnerId()) ?? SIGNED_OUT;
}

/** The owner, the action in the log, and an expected failure as its message; any other as FAILED. */
async function guarded<T extends object>(action: string, fn: (ownerId: string) => Promise<T>): Promise<Result<T>> {
  const o = await owner();
  if (typeof o !== "string") return o;
  try {
    return { ok: true, ...(await withLog(`interview.${action}`, { ownerId: o }, () => fn(o))) };
  } catch (e) {
    if (e instanceof InterviewError) return { ok: false, message: e.message === "limit" ? LIMIT : e.message };
    return { ok: false, message: FAILED };
  }
}

const Id = z.string().min(1).max(64);
const QuestionId = z.string().regex(/^q\d{1,2}$/);
const Seconds = z.number().int().min(0).max(4 * 3600);

type CvRow = { id: string; title: string; data: CvData; updatedAt: Date };

/** The owner's CVs, the latest first. */
function ownedCvs(ownerId: string): Promise<CvRow[]> {
  return db.select({ id: cvs.id, title: cvs.title, data: cvs.data, updatedAt: cvs.updatedAt })
    .from(cvs).where(eq(cvs.ownerId, ownerId)).orderBy(desc(cvs.updatedAt));
}

async function ownedJob(ownerId: string, id: string): Promise<Application | null> {
  const [row] = await db.select().from(applications).where(and(eq(applications.id, id), eq(applications.ownerId, ownerId)));
  return row ?? null;
}

/** The CV a job is practised with (§12.2): the one chosen; else the one sent for it; else the latest. */
function cvFor(job: Pick<Application, "cvId">, list: CvRow[], chosen?: string | null) {
  const picked = chosen ? list.find((c) => c.id === chosen) : undefined;
  if (picked) return { cv: picked, why: "chosen" as const };
  const sent = list.find((c) => c.id === job.cvId);
  if (sent) return { cv: sent, why: "sent" as const };
  return list[0] ? { cv: list[0], why: "latest" as const } : null;
}

/** What the interviewer asks about: the post's requirements, each with the CV line that shows it. */
const itemsOf = (cv: CvData | null, post: string | null): AskItem[] => (post?.trim() ? askAbout(cv ?? emptyCvData(), post) : []);

/** The time a session used can't be more than the time since it started, whatever the page says. */
const elapsed = (s: InterviewSession, reported: number) =>
  Math.min(reported, Math.ceil((Date.now() - s.createdAt.getTime()) / 1000));

/** The first moment of next month (UTC): when the month's sessions come back. */
const nextMonth = (now = new Date()) => Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);

async function sessionsFor(ownerId: string, applicationId: string): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(interviewSessions)
    .where(and(eq(interviewSessions.ownerId, ownerId), eq(interviewSessions.applicationId, applicationId)));
  return Number(row?.n ?? 0);
}

/** The pack, or why there can't be one. */
function packOrRefuse(input: PackInput) {
  try {
    return buildPack(input);
  } catch (e) {
    if (e instanceof PackError) throw new InterviewError(NO_LINES);
    throw e;
  }
}

/** The session's job, its CV as it is now, and what the post asks for, read against that CV. */
async function contextOf(ownerId: string, session: InterviewSession) {
  const [job, [cv]] = await Promise.all([
    ownedJob(ownerId, session.applicationId),
    db.select({ data: cvs.data }).from(cvs).where(and(eq(cvs.id, session.cvId), eq(cvs.ownerId, ownerId))),
  ]);
  return { job, cv: cv?.data ?? null, items: itemsOf(cv?.data ?? null, job?.description ?? null) };
}

/** The turns of some of the owner's sessions, as the report reads them. */
async function turnsOf(ownerId: string, sessionIds: string[]): Promise<(TurnLike & { sessionId: string })[]> {
  if (!sessionIds.length) return [];
  return db.select({
    sessionId: interviewTurns.sessionId, questionId: interviewTurns.questionId, position: interviewTurns.position,
    kind: interviewTurns.kind, answer: interviewTurns.answer, measures: interviewTurns.measures,
  }).from(interviewTurns).where(and(eq(interviewTurns.ownerId, ownerId), inArray(interviewTurns.sessionId, sessionIds)));
}

/** Is the trainer's model there right now (the switch, a model named, allowed here)? */
const aiOn = () => interviewAi().ready;

/** May this owner's sessions have the model: it is there, and they agreed to their answers going to it. */
async function aiFor(ownerId: string, agreesNow = false): Promise<boolean> {
  return aiOn() && (agreesNow || (await hasAiConsent(ownerId, INTERVIEW_CONSENT)));
}

/** The time a session has left, by what the server kept of it. */
const timeIsUp = (s: InterviewSession) => s.secondsUsed >= s.minutes * 60;

/* ── Trainer home ─────────────────────────────────────────────────────── */

export type HomeJob = {
  id: string;
  role: string;
  company: string;
  location: string | null;
  status: ApplicationStatus;
  /** when it moved to Interview (ms); null when the history doesn't say */
  since: number | null;
  /** the post's required items the CV meets, as Job Fit counts them; null without a post, a CV or a required item */
  required: { met: number; total: number } | null;
  /** sessions with at least one answer */
  practised: number;
  lastAt: number | null;
  lastReportId: string | null;
  /** over the job's sessions: the requirements with proof, and the required ones still without it */
  proven: string[];
  notYet: string[];
};
export type OtherJob = { id: string; role: string; company: string; status: ApplicationStatus };
export type PastSession = {
  id: string;
  at: number;
  role: string;
  company: string;
  kind: InterviewKind;
  minutes: number;
  mode: InterviewMode;
  status: InterviewStatus;
};
export type TrainerHome = {
  used: number;
  limit: number;
  resetsOn: number;
  hasCv: boolean;
  /** the interviewer can be the model right now: the page says "AI interviewer" only then (rule 10) */
  ai: boolean;
  /** the jobs in Interview, from the Tracker */
  interviews: HomeJob[];
  /** Applied and Saved, the latest first */
  others: OtherJob[];
  past: PastSession[];
};

/** Past sessions on the home page; older ones stay in the job's reports. */
const PAST_SHOWN = 10;

/** Sessions with at least one answer: practice, not a session opened and left. */
async function practisedIds(ownerId: string): Promise<Set<string>> {
  const rows = await db.selectDistinct({ id: interviewTurns.sessionId }).from(interviewTurns)
    .where(and(eq(interviewTurns.ownerId, ownerId), isNotNull(interviewTurns.answer)));
  return new Set(rows.map((r) => r.id));
}

export async function getTrainerHome(): Promise<Result<{ home: TrainerHome }>> {
  return guarded("home", async (ownerId) => {
    const [jobs, cvList, sessions, used, practised] = await Promise.all([
      db.select().from(applications).where(eq(applications.ownerId, ownerId)).orderBy(desc(applications.updatedAt)),
      ownedCvs(ownerId),
      listSessions(ownerId),
      countThisMonth(ownerId),
      practisedIds(ownerId),
    ]);
    const live = jobs.filter((j) => !j.archivedAt);
    const inInterview = live.filter((j) => j.status === "interview");
    const ids = inInterview.map((j) => j.id);
    const since = new Map<string, number>();
    if (ids.length) {
      const rows = await db.select({ id: applicationEvents.applicationId, at: max(applicationEvents.at) }).from(applicationEvents)
        .where(and(eq(applicationEvents.ownerId, ownerId), eq(applicationEvents.toStatus, "interview"), inArray(applicationEvents.applicationId, ids)))
        .groupBy(applicationEvents.applicationId);
      for (const r of rows) if (r.at) since.set(r.id, new Date(r.at).getTime());
    }
    const ofJob = (id: string) => sessions.filter((s) => s.applicationId === id);
    const turns = await turnsOf(ownerId, sessions.filter((s) => ids.includes(s.applicationId)).map((s) => s.id));
    const texts = new Map<string, string>();
    const textOf = (cv: CvRow) => texts.get(cv.id) ?? (texts.set(cv.id, cvToText(cv.data)), texts.get(cv.id) as string);

    const interviews: HomeJob[] = inInterview.map((j) => {
      const pick = cvFor(j, cvList);
      const mine = ofJob(j.id).filter((s) => practised.has(s.id));
      const fit = pick && j.description?.trim() ? jobFit(textOf(pick.cv), j.description).required : null;
      const { proven, notYet } = mine.length
        ? proofSoFar(mine.map((s) => ({ pack: s.pack, turns: turns.filter((t) => t.sessionId === s.id) })), itemsOf(pick?.cv.data ?? null, j.description))
        : { proven: [], notYet: [] };
      return {
        id: j.id, role: j.role, company: j.company, location: j.location, status: j.status,
        since: since.get(j.id) ?? null,
        required: fit && fit.total > 0 ? fit : null,
        practised: mine.length,
        lastAt: mine[0]?.createdAt.getTime() ?? null,
        lastReportId: ofJob(j.id).find((s) => s.status === "done")?.id ?? null,
        proven, notYet,
      };
    });
    const byId = new Map(jobs.map((j) => [j.id, j]));
    return {
      home: {
        used, limit: INTERVIEW_SESSIONS_PER_MONTH, resetsOn: nextMonth(), hasCv: cvList.length > 0, ai: aiOn(),
        interviews,
        others: live.filter((j) => j.status === "applied" || j.status === "saved")
          .map((j) => ({ id: j.id, role: j.role, company: j.company, status: j.status })),
        past: sessions.slice(0, PAST_SHOWN).flatMap((s) => {
          const j = byId.get(s.applicationId);
          return j ? [{ id: s.id, at: s.createdAt.getTime(), role: j.role, company: j.company, kind: s.kind, minutes: s.minutes, mode: s.mode, status: s.status }] : [];
        }),
      },
    };
  });
}

/** "Practice this interview" on a Tracker job: how many times each job was practised. */
export async function getPracticeCounts(): Promise<Result<{ counts: Record<string, number> }>> {
  return guarded("counts", async (ownerId) => {
    const rows = await db.select({ id: interviewSessions.applicationId, n: sql<number>`count(distinct ${interviewSessions.id})::int` })
      .from(interviewSessions)
      .innerJoin(interviewTurns, and(
        eq(interviewTurns.sessionId, interviewSessions.id), eq(interviewTurns.ownerId, ownerId), isNotNull(interviewTurns.answer),
      ))
      .where(eq(interviewSessions.ownerId, ownerId))
      .groupBy(interviewSessions.applicationId);
    return { counts: Object.fromEntries(rows.map((r) => [r.id, Number(r.n)])) };
  });
}

/* ── Setup ────────────────────────────────────────────────────────────── */

export type SetupView = {
  job: { id: string; role: string; company: string; status: ApplicationStatus };
  cvs: { id: string; title: string }[];
  /** the CV the questions come from, and why that one */
  cv: { id: string; title: string; why: "chosen" | "sent" | "latest" } | null;
  hasLines: boolean;
  hasPost: boolean;
  /** "What the interviewer will ask about": the post's requirements, required first */
  items: { label: string; required: boolean; inCv: boolean }[];
  used: number;
  limit: number;
  resetsOn: number;
  /** sessions for this job so far, and the last finished one */
  sessions: number;
  lastReportId: string | null;
  /**
   * The model, when the interviewer can be one right now; null: the trainer works without AI. `agreed`:
   * the person already agreed to their answers going to it, so Setup doesn't ask again. `provider`
   * is who gets the answers, as the agreement names them.
   */
  ai: { agreed: boolean; provider: string; name: string } | null;
  /** the style of the person's last session with the model for this job: Setup starts from it; null on the first */
  lastStyle: InterviewStyle | null;
};

export async function getSetup(applicationId: string, cvId?: string | null): Promise<Result<{ setup: SetupView }>> {
  if (!Id.safeParse(applicationId).success || (cvId != null && !Id.safeParse(cvId).success)) return { ok: false, message: NO_JOB };
  return guarded("setup", async (ownerId) => {
    const job = await ownedJob(ownerId, applicationId);
    if (!job) throw new InterviewError(NO_JOB);
    const [cvList, used, sessions] = await Promise.all([ownedCvs(ownerId), countThisMonth(ownerId), listSessions(ownerId, { applicationId })]);
    const pick = cvFor(job, cvList, cvId);
    const ai = interviewAi();
    return {
      setup: {
        job: { id: job.id, role: job.role, company: job.company, status: job.status },
        cvs: cvList.map((c) => ({ id: c.id, title: c.title })),
        cv: pick ? { id: pick.cv.id, title: pick.cv.title, why: pick.why } : null,
        hasLines: pick ? cvLines(pick.cv.data).length > 0 : false,
        hasPost: Boolean(job.description?.trim()),
        items: itemsOf(pick?.cv.data ?? null, job.description).map((i) => ({ label: i.label, required: i.required, inCv: Boolean(i.proof) || i.listed })),
        used, limit: INTERVIEW_SESSIONS_PER_MONTH, resetsOn: nextMonth(),
        sessions: sessions.length,
        lastReportId: sessions.find((s) => s.status === "done")?.id ?? null,
        ai: ai.ready
          ? { agreed: await hasAiConsent(ownerId, INTERVIEW_CONSENT), provider: PROVIDER_LABEL[ai.provider], name: PROVIDER_NAME[ai.provider] }
          : null,
        lastStyle: sessions.find((s) => s.ai)?.style ?? null,
      },
    };
  });
}

const StartInput = z.object({
  applicationId: Id,
  cvId: Id,
  kind: z.enum(["recruiter", "technical", "manager"]),
  minutes: z.union([z.literal(10), z.literal(20)]),
  feedbackWhen: z.enum(["each", "end"]),
  timer: z.boolean(),
  /** with the model: how the interviewer asks (IV-11), and English notes on each answer (IV-12) */
  style: z.enum(["friendly", "neutral", "tough"]).optional(),
  englishNotes: z.boolean().optional(),
  /** the person ticked "I understand the interviewer is an AI and my answers go to …" just now */
  consent: z.boolean().optional(),
});
export type StartInput = z.input<typeof StartInput>;

/**
 * "Start interview": the pack is made here, from the owner's job and CV, and the month's limit is
 * checked. The session has the model when it is there and the person agreed, now or before; else it
 * is a session without AI, whatever style was sent.
 */
export async function startInterview(input: StartInput): Promise<Result<{ id: string }>> {
  const p = StartInput.safeParse(input);
  if (!p.success) return { ok: false, message: "Choose the interview again." };
  const { applicationId, cvId, kind, minutes, feedbackWhen, timer } = p.data;
  return guarded("start", async (ownerId) => {
    const job = await ownedJob(ownerId, applicationId);
    if (!job) throw new InterviewError(NO_JOB);
    const [cv] = await db.select().from(cvs).where(and(eq(cvs.id, cvId), eq(cvs.ownerId, ownerId)));
    if (!cv) throw new InterviewError(NO_CV);
    const pack = packOrRefuse({
      cv: cv.data, post: job.description ?? "", role: job.role, company: job.company, kind, minutes,
      // each new session for the job asks in other words
      variant: await sessionsFor(ownerId, job.id),
    });
    const ai = await aiFor(ownerId, p.data.consent === true);
    const session = await createSession(ownerId, {
      applicationId: job.id, cvId: cv.id, kind, minutes, feedbackWhen, timer, pack,
      mode: "typing",
      ai,
      // the style and the English notes are the model's: without it, IV-11's default and no notes
      style: ai ? p.data.style ?? "friendly" : "friendly",
      englishNotes: ai && (p.data.englishNotes ?? true),
    }, { max: INTERVIEW_SESSIONS_PER_MONTH });
    // kept once the session exists: an agreement with nothing started under it would be a record of nothing
    if (ai && p.data.consent === true) await giveAiConsent(ownerId, INTERVIEW_CONSENT);
    return { id: session.id };
  });
}

/* ── The session ──────────────────────────────────────────────────────── */

/**
 * One try at a question: its answer, the follow-ups the interviewer asked on it with their answers,
 * what all of it measured, and the model's feedback once it is made.
 */
export type LiveTurn = {
  /** the question's own turn: the feedback is kept on it */
  id: string;
  questionId: string;
  /** null: skipped */
  answer: string | null;
  /** the follow-ups, in order; an answer of null: skipped */
  follow: { question: string; answer: string | null }[];
  seconds: number;
  words: number;
  fillers: { word: string; count: number }[];
  /** the requirement (when the question asks about one) and the proof from the CV, with the answer's words */
  criteria: InterviewCriterion[];
  /** the post's requirements the answers named */
  named: string[];
  /** the question's CV line, and its facts the answers used and didn't */
  cvLine: string;
  used: string[];
  unused: string[];
  /** the line's words around the numbers the answers didn't say ("6 hours to 1"), when they said none */
  numbers: string | null;
  /** the model's feedback on this try; null: a session without it, a skipped question, or not made yet */
  ai: AiFeedback | null;
};
export type LiveSession = {
  id: string;
  applicationId: string;
  role: string;
  company: string;
  kind: InterviewKind;
  minutes: number;
  mode: InterviewMode;
  feedbackWhen: InterviewFeedbackWhen;
  timer: boolean;
  status: InterviewStatus;
  secondsUsed: number;
  /** the interviewer is the model: follow-ups, and its feedback on each answer */
  ai: boolean;
  style: InterviewStyle;
  englishNotes: boolean;
  /** what the interviewer says first, when it is the model: that it is an AI (AI Act, article 50(1)) */
  opening: string | null;
  questions: { id: string; text: string; requirement: string | null }[];
  /** the tries so far, in the order they were given */
  turns: LiveTurn[];
  /** the follow-up that waits for an answer */
  pending: InterviewPending | null;
  maxTries: number;
};

type TurnRow = Pick<InterviewTurn,
  "id" | "position" | "kind" | "questionId" | "question" | "answer" | "measures" | "requirement" | "bullet" | "feedback" | "better" | "dismissed">;

function liveTurn(x: Exchange<TurnRow>, items: AskItem[]): LiveTurn {
  const t = x.turn;
  const answers = answersOf(x);
  const m = measuresOf(x);
  const used = m?.cvFacts?.used ?? [];
  const unused = m?.cvFacts?.unused ?? [];
  const numbers = unused.filter((f) => /\d/.test(f));
  return {
    id: t.id,
    questionId: t.questionId,
    answer: t.answer,
    follow: x.follow.map((f) => ({ question: f.question, answer: f.answer })),
    seconds: m?.seconds ?? 0,
    words: m?.words ?? 0,
    fillers: m?.fillers ?? [],
    criteria: t.answer != null && m ? measuredCriteria(answers, m, t.requirement) : [],
    named: t.answer != null ? requirementsNamed(answers.join("\n"), items) : [],
    cvLine: t.bullet?.text ?? "",
    used,
    unused,
    numbers: numbers.length && !used.some((f) => /\d/.test(f)) ? numberSpan(t.bullet?.text ?? "", numbers) : null,
    ai: t.answer != null ? aiFeedbackOf(t) : null,
  };
}

/** "Hi Ana, I’m an AI interviewer, not a person. …": the first name is the CV's, and stays on the person's screen. */
function openingLine(cv: CvData | null, job: Application | null): string {
  const first = (cv?.personalInfo.name ?? "").trim().split(/\s+/)[0] ?? "";
  return `Hi${first ? ` ${first}` : ""}, I’m an AI interviewer, not a person. I’ll ask you about ${theRole(job?.role ?? "", job?.company ?? "")}. Ready when you are.`;
}

function liveView(session: InterviewSession, turns: TurnRow[], ctx: { job: Application | null; cv: CvData | null; items: AskItem[] }): LiveSession {
  return {
    id: session.id,
    applicationId: session.applicationId,
    role: ctx.job?.role ?? "",
    company: ctx.job?.company ?? "",
    kind: session.kind,
    minutes: session.minutes,
    mode: session.mode,
    feedbackWhen: session.feedbackWhen,
    timer: session.timer,
    status: session.status,
    secondsUsed: session.secondsUsed,
    ai: session.ai,
    style: session.style,
    englishNotes: session.englishNotes,
    opening: session.ai ? openingLine(ctx.cv, ctx.job) : null,
    questions: session.pack.questions.map(({ id, text, requirement }) => ({ id, text, requirement })),
    turns: exchangesOf(turns).map((x) => liveTurn(x, ctx.items)),
    pending: session.pending ?? null,
    maxTries: MAX_TRIES,
  };
}

export async function getInterview(id: string): Promise<Result<{ session: LiveSession }>> {
  if (!Id.safeParse(id).success) return { ok: false, message: GONE };
  return guarded("view", async (ownerId) => {
    const found = await getSession(ownerId, id);
    if (!found) throw new InterviewError(GONE);
    return { session: liveView(found.session, found.turns, await contextOf(ownerId, found.session)) };
  });
}

/** What was typed, as an answer; or why it isn't one. */
function answerText(input: { answer?: unknown } | null | undefined): { text: string } | { message: string } {
  const text = typeof input?.answer === "string" ? input.answer.trim() : "";
  if (!text) return { message: "Type your answer first, or skip the question." };
  if (text.length > MAX_ANSWER) return { message: "Keep your answer under 6,000 characters." };
  return { text };
}

/** The try a session is on: its last one, as it stands now. */
async function lastTry(ownerId: string, id: string): Promise<{ session: InterviewSession; x: Exchange<TurnRow> }> {
  const found = await getSession(ownerId, id);
  const x = found ? exchangesOf<TurnRow>(found.turns).at(-1) : undefined;
  if (!found || !x) throw new InterviewError(GONE);
  return { session: found.session, x };
}

/** May the interviewer ask (another) follow-up on this try: it is the model, the style has one left, there is time. */
const mayFollowUp = (session: InterviewSession, x: Exchange<TurnRow>) =>
  session.ai && session.status !== "done" && !x.turn.feedback && [x.turn, ...x.follow].at(-1)?.answer != null
  && x.follow.length < FOLLOW_UPS[session.style] && !timeIsUp(session);

/**
 * An answer, typed: measured here, never on the page, and written once. No model is asked here.
 * `mayFollowUp` tells the page whether to ask for a follow-up next (askForFollowUp).
 */
export async function answerQuestion(
  id: string,
  input: { questionId: string; answer: string; seconds: number; secondsUsed: number },
): Promise<Result<{ turn: LiveTurn; mayFollowUp: boolean }>> {
  const a = answerText(input);
  if ("message" in a) return { ok: false, message: a.message };
  const p = z.object({ questionId: QuestionId, seconds: Seconds, secondsUsed: Seconds }).safeParse(input);
  if (!Id.safeParse(id).success || !p.success) return { ok: false, message: GONE };
  return guarded("answer", async (ownerId) => {
    const found = await getSession(ownerId, id);
    if (!found) throw new InterviewError(GONE);
    const { session, turns } = found;
    if (session.status === "done") throw new InterviewError(ENDED);
    const q = session.pack.questions.find((x) => x.id === p.data.questionId);
    if (!q) throw new InterviewError("That question isn’t in this interview.");
    // the tries at this question; its follow-ups aren't tries
    const before = turns.filter((t) => t.kind === "question" && t.questionId === q.id);
    if (before.some((t) => t.answer == null)) throw new InterviewError("You skipped this question.");
    if (before.length >= MAX_TRIES) throw new InterviewError(`You’ve answered this one ${MAX_TRIES} times. Go on to the next question.`);
    const measures = measureAnswer({ text: a.text, seconds: p.data.seconds, mode: "typing", requirement: q.requirement, bullet: q.bullet });
    const turn = await addTurn(ownerId, id, {
      round: session.round, kind: "question", questionId: q.id, question: q.text, requirement: q.requirement,
      bullet: q.bullet, answer: a.text, answeredBy: "typing", measures,
    });
    const now = await updateSession(ownerId, id, { status: "live", secondsUsed: elapsed(session, p.data.secondsUsed) });
    const { items } = await contextOf(ownerId, session);
    const x = { turn, follow: [] };
    return { turn: liveTurn(x, items), mayFollowUp: mayFollowUp(now, x) };
  });
}

/** "Skip this question": a turn with no answer, so the report says it was skipped. */
export async function skipQuestion(id: string, input: { questionId: string; secondsUsed: number }): Promise<Result<{ turn: LiveTurn }>> {
  const p = z.object({ questionId: QuestionId, secondsUsed: Seconds }).safeParse(input);
  if (!Id.safeParse(id).success || !p.success) return { ok: false, message: GONE };
  return guarded("skip", async (ownerId) => {
    const found = await getSession(ownerId, id);
    if (!found) throw new InterviewError(GONE);
    const { session, turns } = found;
    if (session.status === "done") throw new InterviewError(ENDED);
    const q = session.pack.questions.find((x) => x.id === p.data.questionId);
    if (!q) throw new InterviewError("That question isn’t in this interview.");
    if (turns.some((t) => t.questionId === q.id)) throw new InterviewError("This question already has an answer.");
    const turn = await addTurn(ownerId, id, {
      round: session.round, kind: "question", questionId: q.id, question: q.text, requirement: q.requirement,
      bullet: q.bullet, answer: null,
    });
    await updateSession(ownerId, id, { status: "live", secondsUsed: elapsed(session, p.data.secondsUsed) });
    return { turn: liveTurn({ turn, follow: [] }, []) };
  });
}

/**
 * The interviewer's follow-up on the last answer, when it has one: the model proposes it, the code
 * checks it (follow-up.ts), and it waits on the session until it is answered or skipped. Null: the
 * interview moves on, which is also what happens when the model can't be asked. Asking twice returns
 * the follow-up that waits, without another run.
 */
export async function askForFollowUp(id: string): Promise<Result<{ followUp: InterviewPending | null }>> {
  if (!Id.safeParse(id).success) return { ok: false, message: GONE };
  return guarded("followUp", async (ownerId) => {
    const found = await getSession(ownerId, id);
    if (!found) throw new InterviewError(GONE);
    const { session, turns } = found;
    if (session.pending) return { followUp: session.pending };
    const x = exchangesOf<TurnRow>(turns).at(-1);
    if (!x || !mayFollowUp(session, x)) return { followUp: null };
    const model = interviewModel();
    if (!model || !(await spendRun(ownerId))) return { followUp: null };
    const { job } = await contextOf(ownerId, session);
    let text: string | null;
    try {
      text = await askFollowUp(model, {
        kind: session.kind, style: session.style, role: job?.role ?? "", company: job?.company ?? "",
        requirement: x.turn.requirement, cvLine: x.turn.bullet?.text ?? "",
        exchange: [x.turn, ...x.follow].map((t) => ({ question: t.question, answer: t.answer })),
      });
    } catch (e) {
      // no model, no follow-up: the interview goes on (the run is in the log, by its code)
      if (!(e instanceof AiError)) throw e;
      text = null;
    }
    if (!text) return { followUp: null };
    const pending: InterviewPending = { questionId: x.turn.questionId, n: x.follow.length + 1, text };
    if (await setPending(ownerId, id, pending)) return { followUp: pending };
    // something else got there first (another tab, the end of the session): what the session holds is the answer
    return { followUp: (await getSession(ownerId, id))?.session.pending ?? null };
  });
}

/** The answer to the follow-up that waits: measured against the same requirement and CV line as its question. */
export async function answerFollowUp(
  id: string,
  input: { answer: string; seconds: number; secondsUsed: number },
): Promise<Result<{ turn: LiveTurn; mayFollowUp: boolean }>> {
  const a = answerText(input);
  if ("message" in a) return { ok: false, message: a.message };
  const p = z.object({ seconds: Seconds, secondsUsed: Seconds }).safeParse(input);
  if (!Id.safeParse(id).success || !p.success) return { ok: false, message: GONE };
  return guarded("followUpAnswer", async (ownerId) => {
    const found = await getSession(ownerId, id);
    if (!found) throw new InterviewError(GONE);
    const { session } = found;
    if (session.status === "done") throw new InterviewError(ENDED);
    const waiting = session.pending;
    const q = waiting && session.pack.questions.find((x) => x.id === waiting.questionId);
    if (!waiting || !q) throw new InterviewError(NO_FOLLOW_UP);
    const measures = measureAnswer({ text: a.text, seconds: p.data.seconds, mode: "typing", requirement: q.requirement, bullet: q.bullet });
    try {
      await addTurn(ownerId, id, {
        round: session.round, kind: "follow_up", questionId: q.id, question: waiting.text, requirement: q.requirement,
        bullet: q.bullet, answer: a.text, answeredBy: "typing", measures,
      });
    } catch (e) {
      // answered a moment ago, from another tab
      if (e instanceof InterviewError && /follow-up/.test(e.message)) throw new InterviewError(NO_FOLLOW_UP);
      throw e;
    }
    await updateSession(ownerId, id, { status: "live", secondsUsed: elapsed(session, p.data.secondsUsed) });
    const { items } = await contextOf(ownerId, session);
    const now = await lastTry(ownerId, id);
    return { turn: liveTurn(now.x, items), mayFollowUp: mayFollowUp(now.session, now.x) };
  });
}

/** "Skip this question" on a follow-up: it becomes a turn with no answer, and the interviewer asks no more on this question. */
export async function skipFollowUp(id: string, input: { secondsUsed: number }): Promise<Result<{ turn: LiveTurn }>> {
  const p = z.object({ secondsUsed: Seconds }).safeParse(input);
  if (!Id.safeParse(id).success || !p.success) return { ok: false, message: GONE };
  return guarded("followUpSkip", async (ownerId) => {
    const found = await getSession(ownerId, id);
    if (!found) throw new InterviewError(GONE);
    const { session } = found;
    if (session.status === "done") throw new InterviewError(ENDED);
    const waiting = session.pending;
    const q = waiting && session.pack.questions.find((x) => x.id === waiting.questionId);
    if (!waiting || !q) throw new InterviewError(NO_FOLLOW_UP);
    await addTurn(ownerId, id, {
      round: session.round, kind: "follow_up", questionId: q.id, question: waiting.text, requirement: q.requirement,
      bullet: q.bullet, answer: null,
    });
    await updateSession(ownerId, id, { status: "live", secondsUsed: elapsed(session, p.data.secondsUsed) });
    const { items } = await contextOf(ownerId, session);
    return { turn: liveTurn((await lastTry(ownerId, id)).x, items) };
  });
}

/**
 * The model's feedback on one try, made once and kept (feedback.ts). `ai` says what the page has:
 * - "ready": the try has its feedback (just made, or kept from before);
 * - "none": this try gets none (a session without the model, a skipped question);
 * - "unavailable": the model couldn't be asked now (switched off, the day's runs used up, an error).
 *   The page shows what the answer measured, and may ask again later.
 */
export async function getFeedback(id: string, turnId: string): Promise<Result<{ turn: LiveTurn; ai: "ready" | "none" | "unavailable" }>> {
  if (!Id.safeParse(id).success || !Id.safeParse(turnId).success) return { ok: false, message: GONE };
  return guarded("feedback", async (ownerId) => {
    const found = await getSession(ownerId, id);
    if (!found) throw new InterviewError(GONE);
    const { session, turns } = found;
    const all = exchangesOf<TurnRow>(turns);
    const x = all.find((e) => e.turn.id === turnId);
    if (!x) throw new InterviewError("That answer isn’t in this interview.");
    const ctx = await contextOf(ownerId, session);
    const view = (e: Exchange<TurnRow>) => liveTurn(e, ctx.items);
    if (!session.ai || x.turn.answer == null) return { turn: view(x), ai: "none" as const };
    if (x.turn.feedback) return { turn: view(x), ai: "ready" as const };
    // a try is read when it is whole: while its follow-up waits, the answer isn't finished
    if (session.pending && x === all.at(-1)) throw new InterviewError("Answer the follow-up question first, or skip it.");
    const model = interviewModel();
    if (!model || !(await spendRun(ownerId))) return { turn: view(x), ai: "unavailable" as const };
    // the job the CV line comes from, when the CV still has that line in those words
    const line = x.turn.bullet && ctx.cv ? lineAt(ctx.cv, x.turn.bullet.ref) : null;
    const from = line && line.text === x.turn.bullet?.text ? line : null;
    try {
      const made = await giveFeedback(model, {
        kind: session.kind, role: ctx.job?.role ?? "", company: ctx.job?.company ?? "",
        requirement: x.turn.requirement, cvLine: x.turn.bullet?.text ?? "", cvRole: from?.role, cvOrg: from?.org,
        exchange: [x.turn, ...x.follow].map((t) => ({ question: t.question, answer: t.answer })),
        english: session.englishNotes,
      });
      await addFeedback(ownerId, x.turn.id, made.feedback, made.better);
    } catch (e) {
      if (!(e instanceof AiError)) throw e;
      return { turn: view(x), ai: "unavailable" as const };
    }
    // what was kept: ours, or the one another request wrote first
    const kept = exchangesOf<TurnRow>((await getSession(ownerId, id))?.turns ?? []).find((e) => e.turn.id === turnId);
    return { turn: view(kept ?? x), ai: kept?.turn.feedback ? ("ready" as const) : ("unavailable" as const) };
  });
}

/** "I said it right" on an English note (B2): the note goes from the screen and from the session's counts. */
export async function dismissEnglishNote(id: string, input: { turnId: string; index: number }): Promise<Result<{ turn: LiveTurn }>> {
  const p = z.object({ turnId: Id, index: z.number().int().min(0).max(9) }).safeParse(input);
  if (!Id.safeParse(id).success || !p.success) return { ok: false, message: GONE };
  return guarded("dismissNote", async (ownerId) => {
    const found = await getSession(ownerId, id);
    const x = found ? exchangesOf<TurnRow>(found.turns).find((e) => e.turn.id === p.data.turnId) : undefined;
    if (!found || !x) throw new InterviewError(GONE);
    if (!(await dismissNote(ownerId, x.turn.id, p.data.index))) throw new InterviewError("We couldn’t find that note.");
    const { items } = await contextOf(ownerId, found.session);
    const kept = exchangesOf<TurnRow>((await getSession(ownerId, id))?.turns ?? []).find((e) => e.turn.id === p.data.turnId);
    return { turn: liveTurn(kept ?? x, items) };
  });
}

/** "Pause" and "Resume": the clock stops on the page, and the time used so far is kept. */
export async function pauseInterview(id: string, paused: boolean, secondsUsed: number): Promise<Result> {
  if (!Id.safeParse(id).success || !Seconds.safeParse(secondsUsed).success) return { ok: false, message: GONE };
  return guarded("pause", async (ownerId) => {
    const found = await getSession(ownerId, id);
    if (!found) throw new InterviewError(GONE);
    if (found.session.status === "done") throw new InterviewError(ENDED);
    await updateSession(ownerId, id, { status: paused ? "paused" : "live", secondsUsed: elapsed(found.session, secondsUsed) });
    return {};
  });
}

/** "End interview", or the last answer: the session is done, and the report is made from what was said. */
export async function endInterview(id: string, secondsUsed: number): Promise<Result> {
  if (!Id.safeParse(id).success || !Seconds.safeParse(secondsUsed).success) return { ok: false, message: GONE };
  return guarded("end", async (ownerId) => {
    const found = await getSession(ownerId, id);
    if (!found) throw new InterviewError(GONE);
    if (found.session.status !== "done") await updateSession(ownerId, id, { status: "done", secondsUsed: elapsed(found.session, secondsUsed) });
    return {};
  });
}

/* ── The report ───────────────────────────────────────────────────────── */

export type ReportView = {
  id: string;
  applicationId: string;
  role: string;
  company: string;
  at: number;
  kind: InterviewKind;
  minutes: number;
  mode: InterviewMode;
  status: InterviewStatus;
  /** the interviewer was the model: the questions may have its feedback, and the page asks for what is missing (getFeedback) */
  ai: boolean;
  style: InterviewStyle;
  englishNotes: boolean;
  prepared: InterviewPrepared | null;
  /** the session goes on its own after this (INTERVIEW_RETENTION_DAYS) */
  keptUntil: number;
  summary: SessionSummary;
  /** the job's requirements over its last sessions; null on the first one */
  progress: Progress | null;
  sessionsForJob: number;
  /** the post's required items, as Job Fit reads them */
  required: number;
  cvId: string;
  used: number;
  limit: number;
  resetsOn: number;
};

export async function getReport(id: string): Promise<Result<{ report: ReportView }>> {
  if (!Id.safeParse(id).success) return { ok: false, message: GONE };
  return guarded("report", async (ownerId) => {
    const found = await getSession(ownerId, id);
    if (!found) throw new InterviewError(GONE);
    const { session, turns } = found;
    const [{ job, items }, forJob, used] = await Promise.all([
      contextOf(ownerId, session),
      listSessions(ownerId, { applicationId: session.applicationId }),
      countThisMonth(ownerId),
    ]);
    // this session and the ones before it, for the progress table
    const upTo = forJob.filter((s) => s.createdAt.getTime() <= session.createdAt.getTime()).slice(0, PROGRESS_COLUMNS);
    const earlier = await turnsOf(ownerId, upTo.filter((s) => s.id !== session.id).map((s) => s.id));
    return {
      report: {
        id: session.id,
        applicationId: session.applicationId,
        role: job?.role ?? "",
        company: job?.company ?? "",
        at: session.createdAt.getTime(),
        kind: session.kind,
        minutes: session.minutes,
        mode: session.mode,
        status: session.status,
        ai: session.ai,
        style: session.style,
        englishNotes: session.englishNotes,
        prepared: session.prepared ?? null,
        keptUntil: session.createdAt.getTime() + INTERVIEW_RETENTION_DAYS * 864e5,
        summary: summarize({ pack: session.pack, turns, items }),
        progress: progress(upTo.map((s) => ({
          id: s.id, at: s.createdAt.getTime(), kind: s.kind, pack: s.pack,
          turns: s.id === session.id ? turns : earlier.filter((t) => t.sessionId === s.id),
        })), items),
        sessionsForJob: forJob.length,
        required: items.filter((i) => i.required).length,
        cvId: session.cvId,
        used, limit: INTERVIEW_SESSIONS_PER_MONTH, resetsOn: nextMonth(),
      },
    };
  });
}

/** "Do you feel more prepared?" (B7): an answer, never text, on a finished session. */
export async function answerPrepared(id: string, value: InterviewPrepared): Promise<Result> {
  if (!Id.safeParse(id).success || !z.enum(["yes", "a_bit", "no"]).safeParse(value).success) return { ok: false, message: GONE };
  return guarded("prepared", async (ownerId) => {
    if (!(await setPrepared(ownerId, id, value))) throw new InterviewError("Finish the interview first.");
    return {};
  });
}

/** "Delete this session": the answers and the report go; the Tracker job stays. */
export async function deleteInterview(id: string): Promise<Result> {
  if (!Id.safeParse(id).success) return { ok: false, message: GONE };
  return guarded("delete", async (ownerId) => {
    if (!(await deleteSession(ownerId, id))) throw new InterviewError(GONE);
    return {};
  });
}

/**
 * "Practice these again" (IV-16): a 10-minute session that asks the report's questions to practise
 * first, in other words, then the kind's usual ones. It counts toward the month's sessions.
 */
export async function practiceAgain(id: string): Promise<Result<{ id: string }>> {
  if (!Id.safeParse(id).success) return { ok: false, message: GONE };
  return guarded("again", async (ownerId) => {
    const found = await getSession(ownerId, id);
    if (!found) throw new InterviewError(GONE);
    const { session, turns } = found;
    const job = await ownedJob(ownerId, session.applicationId);
    if (!job) throw new InterviewError(NO_JOB);
    const cvList = await ownedCvs(ownerId);
    // the session's CV; if it was deleted since, the latest one
    const cv = cvList.find((c) => c.id === session.cvId) ?? cvList[0];
    if (!cv) throw new InterviewError(NO_CV);
    const { focus } = summarize({ pack: session.pack, turns, items: itemsOf(cv.data, job.description) });
    const pack = packOrRefuse({
      cv: cv.data, post: job.description ?? "", role: job.role, company: job.company, kind: session.kind, minutes: 10,
      variant: await sessionsFor(ownerId, job.id), focus,
    });
    // with the model again when the first one had it, it is still there and the person's agreement still stands
    const ai = session.ai && (await aiFor(ownerId));
    const next = await createSession(ownerId, {
      applicationId: job.id, cvId: cv.id, kind: session.kind, minutes: 10, mode: "typing",
      feedbackWhen: session.feedbackWhen, timer: session.timer, pack, fromSessionId: session.id,
      ai, style: ai ? session.style : "friendly", englishNotes: ai && session.englishNotes,
    }, { max: INTERVIEW_SESSIONS_PER_MONTH });
    return { id: next.id };
  });
}
