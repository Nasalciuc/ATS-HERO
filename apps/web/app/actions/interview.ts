"use server";
/**
 * Interview Trainer (canvas "ATS Hero Tracker v2", page "Interview trainer"; ANTRENOR-INTERVIU-VOCE.md §12).
 *
 * Typing only, for now (ANTRENOR-INTERVIU-CONSTRUCTIE.md, step 4): the questions come from the pack
 * (lib/interview/pack.ts) and an answer's feedback is what it measured (lib/interview/measure.ts and
 * report.ts), without AI. The interviewer's style, follow-ups and English notes come with the model
 * (step 5); speaking with step 6.
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
import { askAbout, buildPack, cvLines, PackError, type AskItem, type PackInput } from "@/lib/interview/pack";
import { measureAnswer, measuredCriteria } from "@/lib/interview/measure";
import {
  numberSpan, progress, PROGRESS_COLUMNS, proofSoFar, requirementsNamed, summarize,
  type Progress, type SessionSummary, type TurnLike,
} from "@/lib/interview/report";
import {
  addTurn, countThisMonth, createSession, deleteSession, getSession, INTERVIEW_SESSIONS_PER_MONTH, InterviewError,
  listSessions, setPrepared, updateSession,
} from "@/lib/interview/store";
import {
  cvToText, emptyCvData, type ApplicationStatus, type CvData, type InterviewCriterion, type InterviewFeedbackWhen,
  type InterviewKind, type InterviewMode, type InterviewPrepared, type InterviewStatus,
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

/** The session's job and what its post asks for, read against the session's CV. */
async function contextOf(ownerId: string, session: InterviewSession) {
  const [job, [cv]] = await Promise.all([
    ownedJob(ownerId, session.applicationId),
    db.select({ data: cvs.data }).from(cvs).where(and(eq(cvs.id, session.cvId), eq(cvs.ownerId, ownerId))),
  ]);
  return { job, items: itemsOf(cv?.data ?? null, job?.description ?? null) };
}

/** The turns of some of the owner's sessions, as the report reads them. */
async function turnsOf(ownerId: string, sessionIds: string[]): Promise<(TurnLike & { sessionId: string })[]> {
  if (!sessionIds.length) return [];
  return db.select({
    sessionId: interviewTurns.sessionId, questionId: interviewTurns.questionId, position: interviewTurns.position,
    answer: interviewTurns.answer, measures: interviewTurns.measures,
  }).from(interviewTurns).where(and(eq(interviewTurns.ownerId, ownerId), inArray(interviewTurns.sessionId, sessionIds)));
}

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
        used, limit: INTERVIEW_SESSIONS_PER_MONTH, resetsOn: nextMonth(), hasCv: cvList.length > 0,
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
};

export async function getSetup(applicationId: string, cvId?: string | null): Promise<Result<{ setup: SetupView }>> {
  if (!Id.safeParse(applicationId).success || (cvId != null && !Id.safeParse(cvId).success)) return { ok: false, message: NO_JOB };
  return guarded("setup", async (ownerId) => {
    const job = await ownedJob(ownerId, applicationId);
    if (!job) throw new InterviewError(NO_JOB);
    const [cvList, used, sessions] = await Promise.all([ownedCvs(ownerId), countThisMonth(ownerId), listSessions(ownerId, { applicationId })]);
    const pick = cvFor(job, cvList, cvId);
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
});
export type StartInput = z.input<typeof StartInput>;

/** "Start interview": the pack is made here, from the owner's job and CV, and the month's limit is checked. */
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
    const session = await createSession(ownerId, {
      applicationId: job.id, cvId: cv.id, kind, minutes, feedbackWhen, timer, pack,
      // IV-11's default; choosing a style comes with the model, which is what a style changes (step 5)
      style: "friendly",
      mode: "typing",
      // the English notes are the model's (step 5)
      englishNotes: false,
    }, { max: INTERVIEW_SESSIONS_PER_MONTH });
    return { id: session.id };
  });
}

/* ── The session ──────────────────────────────────────────────────────── */

export type LiveTurn = {
  id: string;
  questionId: string;
  /** null: skipped */
  answer: string | null;
  seconds: number;
  words: number;
  fillers: { word: string; count: number }[];
  /** the requirement (when the question asks about one) and the proof from the CV, with the answer's words */
  criteria: InterviewCriterion[];
  /** the post's requirements the answer named */
  named: string[];
  /** the question's CV line, and its facts the answer used and didn't */
  cvLine: string;
  used: string[];
  unused: string[];
  /** the line's words around the numbers the answer didn't say ("6 hours to 1"), when it said none */
  numbers: string | null;
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
  questions: { id: string; text: string; requirement: string | null }[];
  turns: LiveTurn[];
  maxTries: number;
};

type TurnRow = Pick<InterviewTurn, "id" | "questionId" | "answer" | "measures" | "requirement" | "bullet">;

function liveTurn(t: TurnRow, items: AskItem[]): LiveTurn {
  const m = t.measures;
  const used = m?.cvFacts?.used ?? [];
  const unused = m?.cvFacts?.unused ?? [];
  const numbers = unused.filter((f) => /\d/.test(f));
  return {
    id: t.id,
    questionId: t.questionId,
    answer: t.answer,
    seconds: m?.seconds ?? 0,
    words: m?.words ?? 0,
    fillers: m?.fillers ?? [],
    criteria: t.answer != null && m ? measuredCriteria(t.answer, m, t.requirement) : [],
    named: t.answer != null ? requirementsNamed(t.answer, items) : [],
    cvLine: t.bullet?.text ?? "",
    used,
    unused,
    numbers: numbers.length && !used.some((f) => /\d/.test(f)) ? numberSpan(t.bullet?.text ?? "", numbers) : null,
  };
}

function liveView(session: InterviewSession, turns: TurnRow[], job: Application | null, items: AskItem[]): LiveSession {
  return {
    id: session.id,
    applicationId: session.applicationId,
    role: job?.role ?? "",
    company: job?.company ?? "",
    kind: session.kind,
    minutes: session.minutes,
    mode: session.mode,
    feedbackWhen: session.feedbackWhen,
    timer: session.timer,
    status: session.status,
    secondsUsed: session.secondsUsed,
    questions: session.pack.questions.map(({ id, text, requirement }) => ({ id, text, requirement })),
    turns: turns.map((t) => liveTurn(t, items)),
    maxTries: MAX_TRIES,
  };
}

export async function getInterview(id: string): Promise<Result<{ session: LiveSession }>> {
  if (!Id.safeParse(id).success) return { ok: false, message: GONE };
  return guarded("view", async (ownerId) => {
    const found = await getSession(ownerId, id);
    if (!found) throw new InterviewError(GONE);
    const { job, items } = await contextOf(ownerId, found.session);
    return { session: liveView(found.session, found.turns, job, items) };
  });
}

/** An answer, typed: measured here, never on the page, and written once. */
export async function answerQuestion(
  id: string,
  input: { questionId: string; answer: string; seconds: number; secondsUsed: number },
): Promise<Result<{ turn: LiveTurn }>> {
  const text = typeof input?.answer === "string" ? input.answer.trim() : "";
  if (!text) return { ok: false, message: "Type your answer first, or skip the question." };
  if (text.length > MAX_ANSWER) return { ok: false, message: "Keep your answer under 6,000 characters." };
  const p = z.object({ questionId: QuestionId, seconds: Seconds, secondsUsed: Seconds }).safeParse(input);
  if (!Id.safeParse(id).success || !p.success) return { ok: false, message: GONE };
  return guarded("answer", async (ownerId) => {
    const found = await getSession(ownerId, id);
    if (!found) throw new InterviewError(GONE);
    const { session, turns } = found;
    if (session.status === "done") throw new InterviewError("This interview has ended.");
    const q = session.pack.questions.find((x) => x.id === p.data.questionId);
    if (!q) throw new InterviewError("That question isn’t in this interview.");
    const before = turns.filter((t) => t.questionId === q.id);
    if (before.some((t) => t.answer == null)) throw new InterviewError("You skipped this question.");
    if (before.length >= MAX_TRIES) throw new InterviewError(`You’ve answered this one ${MAX_TRIES} times. Go on to the next question.`);
    const measures = measureAnswer({ text, seconds: p.data.seconds, mode: "typing", requirement: q.requirement, bullet: q.bullet });
    const turn = await addTurn(ownerId, id, {
      round: session.round, kind: "question", questionId: q.id, question: q.text, requirement: q.requirement,
      bullet: q.bullet, answer: text, answeredBy: "typing", measures,
    });
    await updateSession(ownerId, id, { status: "live", secondsUsed: elapsed(session, p.data.secondsUsed) });
    const { items } = await contextOf(ownerId, session);
    return { turn: liveTurn(turn, items) };
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
    if (session.status === "done") throw new InterviewError("This interview has ended.");
    const q = session.pack.questions.find((x) => x.id === p.data.questionId);
    if (!q) throw new InterviewError("That question isn’t in this interview.");
    if (turns.some((t) => t.questionId === q.id)) throw new InterviewError("This question already has an answer.");
    const turn = await addTurn(ownerId, id, {
      round: session.round, kind: "question", questionId: q.id, question: q.text, requirement: q.requirement,
      bullet: q.bullet, answer: null,
    });
    await updateSession(ownerId, id, { status: "live", secondsUsed: elapsed(session, p.data.secondsUsed) });
    return { turn: liveTurn(turn, []) };
  });
}

/** "Pause" and "Resume": the clock stops on the page, and the time used so far is kept. */
export async function pauseInterview(id: string, paused: boolean, secondsUsed: number): Promise<Result> {
  if (!Id.safeParse(id).success || !Seconds.safeParse(secondsUsed).success) return { ok: false, message: GONE };
  return guarded("pause", async (ownerId) => {
    const found = await getSession(ownerId, id);
    if (!found) throw new InterviewError(GONE);
    if (found.session.status === "done") throw new InterviewError("This interview has ended.");
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
    const next = await createSession(ownerId, {
      applicationId: job.id, cvId: cv.id, kind: session.kind, style: session.style, minutes: 10, mode: "typing",
      feedbackWhen: session.feedbackWhen, timer: session.timer, englishNotes: false, pack, fromSessionId: session.id,
    }, { max: INTERVIEW_SESSIONS_PER_MONTH });
    return { id: next.id };
  });
}
