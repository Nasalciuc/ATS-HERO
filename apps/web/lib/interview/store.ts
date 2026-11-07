/**
 * Interview Trainer, the data (ANTRENOR-INTERVIU-VOCE.md §12.7). Server code: the actions resolve the
 * owner with getOwnerId() and pass it in; every query here filters by it (AGENTS.md rule 4).
 *
 * The rules:
 * - a session belongs to one owner, one of their jobs and one of their CVs; its questions are fixed
 *   when it starts, and each is tied to a CV line;
 * - a turn is written once, when its answer is in: the question, the answer and what it measured
 *   never change. Its feedback and stronger answer are added once, when ready, never rewritten;
 * - a finished session takes no new turns and doesn't go back to live;
 * - deleting a session takes its turns; deleting the job or the account takes the job's sessions;
 * - every session goes on its own INTERVIEW_RETENTION_DAYS after it started (purgeOldSessions).
 */
import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  applications, cvs, interviewSessions, interviewTurns, type InterviewSession, type InterviewTurn,
} from "@/db/schema";
import { INTERVIEW_RETENTION_DAYS } from "@/lib/retention";
import type {
  CvBulletRef, InterviewFeedback, InterviewFeedbackWhen, InterviewKind, InterviewMeasures, InterviewMode,
  InterviewPack, InterviewPrepared, InterviewStatus, InterviewStyle,
} from "@/lib/types";

export class InterviewError extends Error {}

/** Sessions a person can start in a calendar month (IV-9: the paid plan's; the beta gets the paid limits, AG-18). */
export const INTERVIEW_SESSIONS_PER_MONTH = 20;
/** The first moment of the month (UTC) the limit counts from. */
export const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

/** Sessions the owner started this month, for "18 of 20 sessions left this month". */
export async function countThisMonth(ownerId: string, now = new Date()): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(interviewSessions)
    .where(and(eq(interviewSessions.ownerId, ownerId), gte(interviewSessions.createdAt, monthStart(now))));
  return Number(row?.n ?? 0);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type NewSession = {
  applicationId: string;
  cvId: string;
  kind: InterviewKind;
  style: InterviewStyle;
  minutes: 10 | 20;
  mode: InterviewMode;
  feedbackWhen?: InterviewFeedbackWhen;
  timer?: boolean;
  englishNotes?: boolean;
  pack: InterviewPack;
  /** "Practice these again": the session this one was made from */
  fromSessionId?: string;
};

export type NewTurn = {
  round: number;
  kind: "question" | "follow_up";
  questionId: string;
  question: string;
  requirement?: string | null;
  bullet?: CvBulletRef | null;
  /** null: the question was skipped */
  answer: string | null;
  answeredBy?: InterviewMode | null;
  measures?: InterviewMeasures | null;
};

/**
 * Starts a session for one of the owner's jobs, with one of their CVs and a pack whose questions all
 * have a CV line. With `limit`, the month's count is checked in the same transaction, under a lock on
 * the owner, so two starts at once can't both pass it.
 */
export async function createSession(ownerId: string, input: NewSession, limit?: { max: number; now?: Date }): Promise<InterviewSession> {
  if (!input.pack.questions.length) throw new InterviewError("No questions");
  if (input.pack.questions.some((q) => !q.bullet?.ref || !q.bullet.text.trim()))
    throw new InterviewError("A question without a CV line");
  return db.transaction(async (tx) => {
    if (limit) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"interview:" + ownerId}))`);
      const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(interviewSessions)
        .where(and(eq(interviewSessions.ownerId, ownerId), gte(interviewSessions.createdAt, monthStart(limit.now ?? new Date()))));
      if (Number(row?.n ?? 0) >= limit.max) throw new InterviewError("limit");
    }
    // ids come from the client: the job, the CV and the earlier session must be the owner's
    const [job] = await tx.select({ id: applications.id }).from(applications)
      .where(and(eq(applications.id, input.applicationId), eq(applications.ownerId, ownerId)));
    if (!job) throw new InterviewError("Job not found");
    const [cv] = await tx.select({ id: cvs.id }).from(cvs)
      .where(and(eq(cvs.id, input.cvId), eq(cvs.ownerId, ownerId)));
    if (!cv) throw new InterviewError("CV not found");
    if (input.fromSessionId) {
      const [from] = await tx.select({ id: interviewSessions.id }).from(interviewSessions)
        .where(and(eq(interviewSessions.id, input.fromSessionId), eq(interviewSessions.ownerId, ownerId)));
      if (!from) throw new InterviewError("Session not found");
    }
    const [row] = await tx.insert(interviewSessions).values({ ownerId, ...input }).returning();
    return row;
  });
}

/** One of the owner's sessions with its turns in order, or null. */
export async function getSession(ownerId: string, id: string): Promise<{ session: InterviewSession; turns: InterviewTurn[] } | null> {
  const [session] = await db.select().from(interviewSessions)
    .where(and(eq(interviewSessions.id, id), eq(interviewSessions.ownerId, ownerId)));
  if (!session) return null;
  const turns = await db.select().from(interviewTurns)
    .where(and(eq(interviewTurns.sessionId, id), eq(interviewTurns.ownerId, ownerId)))
    .orderBy(asc(interviewTurns.position));
  return { session, turns };
}

/** The owner's sessions, newest first; for one job when asked. */
export async function listSessions(ownerId: string, opts: { applicationId?: string } = {}): Promise<InterviewSession[]> {
  const where = opts.applicationId
    ? and(eq(interviewSessions.ownerId, ownerId), eq(interviewSessions.applicationId, opts.applicationId))
    : eq(interviewSessions.ownerId, ownerId);
  return db.select().from(interviewSessions).where(where).orderBy(desc(interviewSessions.createdAt));
}

/** Adds the next turn to a session that isn't finished. The session row is locked, so two answers can't take one place. */
export async function addTurn(ownerId: string, sessionId: string, turn: NewTurn): Promise<InterviewTurn> {
  return db.transaction(async (tx) => {
    const [session] = await tx.select({ status: interviewSessions.status }).from(interviewSessions)
      .where(and(eq(interviewSessions.id, sessionId), eq(interviewSessions.ownerId, ownerId)))
      .for("update");
    if (!session) throw new InterviewError("Session not found");
    if (session.status === "done") throw new InterviewError("The session is finished");
    const [{ last }] = await tx.select({ last: sql<number>`coalesce(max(${interviewTurns.position}), 0)` })
      .from(interviewTurns).where(eq(interviewTurns.sessionId, sessionId));
    const [row] = await tx.insert(interviewTurns).values({
      sessionId, ownerId, position: Number(last) + 1, round: turn.round, kind: turn.kind,
      questionId: turn.questionId, question: turn.question, requirement: turn.requirement ?? null,
      bullet: turn.bullet ?? null, answer: turn.answer, answeredBy: turn.answeredBy ?? null,
      measures: turn.measures ?? null,
    }).returning();
    return row;
  });
}

/** Adds a turn's feedback and stronger answer, once. False when the turn isn't the owner's or already has them. */
export async function addFeedback(ownerId: string, turnId: string, feedback: InterviewFeedback, better: string | null): Promise<boolean> {
  const rows = await db.update(interviewTurns).set({ feedback, better })
    .where(and(eq(interviewTurns.id, turnId), eq(interviewTurns.ownerId, ownerId), isNull(interviewTurns.feedback)))
    .returning({ id: interviewTurns.id });
  return rows.length === 1;
}

/**
 * Where a live session is: paused or live again, its round, how long it was open. "done" ends it for
 * good (endedAt is set); a finished session doesn't change any more, and its time only grows.
 */
export async function updateSession(
  ownerId: string, id: string,
  patch: { status?: InterviewStatus; round?: number; secondsUsed?: number },
): Promise<InterviewSession> {
  const [row] = await db.update(interviewSessions).set({
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.round !== undefined ? { round: patch.round } : {}),
    // the time used never goes down, even if an old message arrives late
    ...(patch.secondsUsed !== undefined
      ? { secondsUsed: sql`greatest(${interviewSessions.secondsUsed}, ${Math.max(0, Math.round(patch.secondsUsed))})` }
      : {}),
    ...(patch.status === "done" ? { endedAt: new Date() } : {}),
  }).where(and(
    eq(interviewSessions.id, id), eq(interviewSessions.ownerId, ownerId),
    sql`${interviewSessions.status} <> 'done'`,
  )).returning();
  if (!row) throw new InterviewError("Session not found or finished");
  return row;
}

/** The answer to "Do you feel more prepared?", on a finished session. */
export async function setPrepared(ownerId: string, id: string, prepared: InterviewPrepared): Promise<boolean> {
  const rows = await db.update(interviewSessions).set({ prepared })
    .where(and(eq(interviewSessions.id, id), eq(interviewSessions.ownerId, ownerId), eq(interviewSessions.status, "done")))
    .returning({ id: interviewSessions.id });
  return rows.length === 1;
}

/** Deletes the owner's sessions (with their turns): all of them, or one job's, or one session. Inside the caller's transaction. */
export async function removeInterviewData(tx: Tx, ownerId: string, scope: { applicationId?: string; sessionId?: string } = {}) {
  const sessionWhere = and(
    eq(interviewSessions.ownerId, ownerId),
    scope.applicationId ? eq(interviewSessions.applicationId, scope.applicationId) : undefined,
    scope.sessionId ? eq(interviewSessions.id, scope.sessionId) : undefined,
  );
  const ids = tx.select({ id: interviewSessions.id }).from(interviewSessions).where(sessionWhere);
  const turns = await tx.delete(interviewTurns)
    .where(and(eq(interviewTurns.ownerId, ownerId), inArray(interviewTurns.sessionId, ids)))
    .returning({ id: interviewTurns.id });
  const sessions = await tx.delete(interviewSessions).where(sessionWhere).returning({ id: interviewSessions.id });
  return { sessions: sessions.length, turns: turns.length };
}

/** "Delete this session", from its report. */
export async function deleteSession(ownerId: string, id: string): Promise<boolean> {
  const { sessions } = await db.transaction((tx) => removeInterviewData(tx, ownerId, { sessionId: id }));
  return sessions === 1;
}

/** The cron: every session older than the retention goes, with its turns, whoever owns it. */
export async function purgeOldSessions(days = INTERVIEW_RETENTION_DAYS): Promise<{ sessions: number; turns: number }> {
  // the days go in as a bound parameter, like any other value: no raw SQL
  const cutoff = sql`now() - make_interval(days => ${days})`;
  return db.transaction(async (tx) => {
    const old = tx.select({ id: interviewSessions.id }).from(interviewSessions).where(lt(interviewSessions.createdAt, cutoff));
    const turns = await tx.delete(interviewTurns).where(inArray(interviewTurns.sessionId, old)).returning({ id: interviewTurns.id });
    const sessions = await tx.delete(interviewSessions).where(lt(interviewSessions.createdAt, cutoff)).returning({ id: interviewSessions.id });
    return { sessions: sessions.length, turns: turns.length };
  });
}
