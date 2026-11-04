/**
 * "Ready to send" (canvas "ATS Hero Tracker v2", page "Search & agent"): the person's queue for the
 * apply agent. Server code; app/actions/apply-queue.ts resolves the owner and calls these.
 *
 * The rules (AGENTS.md rule 11):
 * - a job enters the queue only because its owner put it there, with one of their own CVs;
 * - the agent prepares one form when the person presses Prepare, fills only what the plan allows,
 *   and keeps it open (READY_MS) for them to check;
 * - nothing is sent without the person's approval of that form (the plan's digest) and their
 *   answers, which are never stored;
 * - the daily limit the person set is checked when they press Send, in one transaction, so two
 *   sends at once can't both pass it; a send that was pressed counts even if the page didn't confirm.
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { applicationEvents, applications, applyQueue, applySettings, cvs, type QueueItem } from "@/db/schema";
import { renderCvPdfBlob } from "@/lib/exportPdf";
import { withLog } from "@/lib/log";
import { platformOf } from "@/lib/tracker";
import type { CvData, QueueStatus } from "@/lib/types";
import { prepareApplication, submitApplication, type Prepared } from "./engine";
import { postingTarget } from "./guard";
import { applyProfile } from "./profile";
import type { Answers, PersonItem } from "./plan";
import type { Runner, RunnerOptions } from "./runner";
import { dropForm, getForm, putForm, READY_MS } from "./sessions";

export const DEFAULT_DAILY_LIMIT = 5;
export const MAX_DAILY_LIMIT = 10;
/** A row left "preparing" or "sending" this long by a server that stopped is put right on the next look. */
const STUCK_MS = 5 * 60 * 1000;

export interface QueueDeps {
  /** the agent's browser for a session; the default runs agent-browser on this machine */
  runner?: (session: string, opts: RunnerOptions) => Runner;
  /** the CV as a PDF; the default is renderCvPdfBlob() (AGENTS.md rule 7) */
  renderPdf?: (data: CvData, template: string, accent?: string) => Promise<Uint8Array>;
  now?: () => Date;
  /** localhost postings: the apply lab's forms, on a developer's machine only */
  allowLocal?: boolean;
}

export class QueueError extends Error {}

const nowOf = (deps: QueueDeps) => (deps.now ? deps.now() : new Date());
/** "Today" for the limit: the UTC day. */
export const dayStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
/** Can the agent go to this job's link? (guard.ts: Greenhouse, Lever, Ashby; the lab on localhost.) */
export const agentCanGo = (url: string | null, allowLocal = false) => Boolean(url) && postingTarget(url as string, { allowLocal }).ok;

const COUNTED: QueueStatus[] = ["sending", "sent", "unconfirmed"];

export async function dailyLimitOf(ownerId: string): Promise<number> {
  const row = await db.query.applySettings.findFirst({ where: eq(applySettings.ownerId, ownerId) });
  return row?.dailyLimit ?? DEFAULT_DAILY_LIMIT;
}

export async function setDailyLimit(ownerId: string, limit: number): Promise<number> {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_DAILY_LIMIT) throw new QueueError(`Choose a limit from 1 to ${MAX_DAILY_LIMIT} a day.`);
  await db.insert(applySettings).values({ ownerId, dailyLimit: limit })
    .onConflictDoUpdate({ target: applySettings.ownerId, set: { dailyLimit: limit } });
  return limit;
}

/** Applications sent today (Send pressed), whatever the page said after. */
export async function sentToday(ownerId: string, now: Date): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(applyQueue).where(and(
    eq(applyQueue.ownerId, ownerId), inArray(applyQueue.status, COUNTED), gte(applyQueue.sendingAt, dayStart(now)),
  ));
  return r?.n ?? 0;
}

/** Rows a stopped server or a closed form left behind, put right: a form that closed waits again. */
async function settle(ownerId: string, now: Date): Promise<void> {
  const stuck = new Date(now.getTime() - STUCK_MS);
  const mine = eq(applyQueue.ownerId, ownerId);
  await db.update(applyQueue).set({ status: "waiting", reason: "interrupted" })
    .where(and(mine, eq(applyQueue.status, "preparing"), lt(applyQueue.updatedAt, stuck)));
  await db.update(applyQueue).set({ status: "unconfirmed", reason: "interrupted" })
    .where(and(mine, eq(applyQueue.status, "sending"), lt(applyQueue.updatedAt, stuck)));
  const ready = await db.select().from(applyQueue).where(and(mine, eq(applyQueue.status, "ready")));
  for (const row of ready) {
    if (await getForm(row.id, ownerId, now.getTime())) continue;
    await db.update(applyQueue).set({ status: "waiting", reason: "expired", readyUntil: null })
      .where(and(eq(applyQueue.id, row.id), eq(applyQueue.status, "ready")));
  }
}

export interface QueueRow {
  id: string;
  applicationId: string;
  role: string;
  company: string;
  location: string | null;
  url: string | null;
  platform: string;
  cvId: string;
  status: QueueStatus;
  reason: string | null;
  readyUntil: number | null;
  sentAt: number | null;
  confirmation: string | null;
}

export interface Candidate {
  applicationId: string;
  role: string;
  company: string;
  platform: string;
  description: string | null;
}

export interface QueueView {
  rows: QueueRow[];
  sentToday: number;
  dailyLimit: number;
  /** Saved jobs the agent can do, not queued yet */
  candidates: Candidate[];
  /** Saved jobs it can't (Workday, Indeed Apply, LinkedIn, other sites): applied to on the site */
  notForAgent: number;
}

export async function queueView(ownerId: string, deps: QueueDeps = {}): Promise<QueueView> {
  const now = nowOf(deps);
  await settle(ownerId, now);
  const rows = await db.select({ q: applyQueue, a: applications }).from(applyQueue)
    .innerJoin(applications, eq(applications.id, applyQueue.applicationId))
    .where(and(eq(applyQueue.ownerId, ownerId), eq(applications.ownerId, ownerId)))
    .orderBy(desc(applyQueue.createdAt));
  const queued = new Set(rows.map((r) => r.a.id));
  const saved = await db.select().from(applications).where(and(
    eq(applications.ownerId, ownerId), eq(applications.status, "saved"), isNull(applications.archivedAt),
  )).orderBy(desc(applications.appliedAt));
  const open = saved.filter((a) => !queued.has(a.id));
  const [count, dailyLimit] = await Promise.all([sentToday(ownerId, now), dailyLimitOf(ownerId)]);
  return {
    rows: rows.map(({ q, a }) => ({
      id: q.id, applicationId: a.id, role: a.role, company: a.company, location: a.location, url: a.url,
      platform: platformOf(a.url), cvId: q.cvId, status: q.status, reason: q.reason,
      readyUntil: q.readyUntil ? q.readyUntil.getTime() : null, sentAt: q.sentAt ? q.sentAt.getTime() : null,
      confirmation: q.confirmation,
    })),
    sentToday: count,
    dailyLimit,
    candidates: open.filter((a) => agentCanGo(a.url, deps.allowLocal)).map((a) => ({
      applicationId: a.id, role: a.role, company: a.company, platform: platformOf(a.url), description: a.description,
    })),
    notForAgent: open.filter((a) => !agentCanGo(a.url, deps.allowLocal)).length,
  };
}

/** Puts the owner's Saved jobs in the queue, with one of their CVs (the one changed last if none is named). */
export async function enqueue(ownerId: string, applicationIds: string[], cvId: string | null, deps: QueueDeps = {}): Promise<number> {
  const ids = [...new Set(applicationIds)].slice(0, 50);
  if (!ids.length) return 0;
  const cv = cvId
    ? await db.query.cvs.findFirst({ where: and(eq(cvs.id, cvId), eq(cvs.ownerId, ownerId)) })
    : await db.query.cvs.findFirst({ where: eq(cvs.ownerId, ownerId), orderBy: [desc(cvs.updatedAt)] });
  if (!cv) throw new QueueError("Save a CV in ATS Hero first: the agent attaches it and takes your contact details from it.");
  const jobs = await db.select().from(applications).where(and(eq(applications.ownerId, ownerId), inArray(applications.id, ids)));
  const ok = jobs.filter((a) => a.status === "saved" && agentCanGo(a.url, deps.allowLocal));
  if (!ok.length) return 0;
  const added = await db.insert(applyQueue).values(ok.map((a) => ({ ownerId, applicationId: a.id, cvId: cv.id })))
    .onConflictDoNothing().returning({ id: applyQueue.id });
  return added.length;
}

/** Takes a job out of the queue; an open form closes, nothing is sent. A job being sent stays. */
export async function dequeue(ownerId: string, id: string): Promise<void> {
  const [row] = await db.delete(applyQueue)
    .where(and(eq(applyQueue.id, id), eq(applyQueue.ownerId, ownerId), sql`${applyQueue.status} <> 'sending'`))
    .returning({ id: applyQueue.id });
  if (row) await dropForm(row.id);
}

async function ownedRow(ownerId: string, id: string): Promise<QueueItem> {
  const row = await db.query.applyQueue.findFirst({ where: and(eq(applyQueue.id, id), eq(applyQueue.ownerId, ownerId)) });
  if (!row) throw new QueueError("This job isn’t in your queue any more.");
  return row;
}

const pdfName = (name: string) => `${name.trim().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "") || "CV"}_CV.pdf`;

const defaultPdf = async (data: CvData, template: string, accent?: string) =>
  new Uint8Array(await (await renderCvPdfBlob(data, template, accent)).arrayBuffer());

/**
 * The agent fills the form: one job, when the person presses Prepare. Refused before a browser starts
 * when today's limit is reached: a form that couldn't be sent would only close again.
 */
export async function prepare(ownerId: string, id: string, deps: QueueDeps = {}): Promise<QueueStatus> {
  const now = nowOf(deps);
  const row = await ownedRow(ownerId, id);
  if (!["waiting", "handoff", "failed"].includes(row.status)) throw new QueueError("This job is already prepared or sent.");
  const [count, limit] = await Promise.all([sentToday(ownerId, now), dailyLimitOf(ownerId)]);
  if (count >= limit) throw new QueueError(`You sent ${count} of ${limit} today. The rest wait for tomorrow.`);

  const [claimed] = await db.update(applyQueue).set({ status: "preparing", reason: null })
    .where(and(eq(applyQueue.id, id), eq(applyQueue.ownerId, ownerId), inArray(applyQueue.status, ["waiting", "handoff", "failed"])))
    .returning();
  if (!claimed) throw new QueueError("This job is already being prepared.");

  const job = await db.query.applications.findFirst({ where: and(eq(applications.id, row.applicationId), eq(applications.ownerId, ownerId)) });
  const cv = await db.query.cvs.findFirst({ where: and(eq(cvs.id, row.cvId), eq(cvs.ownerId, ownerId)) });
  const fail = async (status: QueueStatus, reason: string) => {
    await db.update(applyQueue).set({ status, reason, readyUntil: null }).where(eq(applyQueue.id, id));
    return status;
  };
  if (!job?.url) return fail("refused", "invalid_url");
  if (!cv) return fail("failed", "cv_missing");

  return withLog("applyQueue.prepare", { ownerId, queueId: id }, async () => {
    const data = cv.data as CvData;
    const dir = await mkdtemp(path.join(os.tmpdir(), "ats-hero-cv-"));
    let result: Prepared;
    try {
      const cvPdfPath = path.join(dir, pdfName(data.personalInfo.name));
      await writeFile(cvPdfPath, await (deps.renderPdf ?? defaultPdf)(data, cv.template ?? "classic", cv.accent ?? undefined));
      result = await prepareApplication({
        url: job.url as string, profile: applyProfile(data), cvPdfPath, allowLocal: deps.allowLocal, runner: deps.runner,
      });
    } catch {
      return fail("failed", "agent_error");
    } finally {
      // the file went into the form already; the form keeps it
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
    if (result.status === "refused") return fail("refused", result.reason);
    if (result.status === "handoff") {
      await rm(path.dirname(result.screenshot), { recursive: true, force: true }).catch(() => undefined);
      return fail("handoff", result.reason);
    }
    const expiresAt = now.getTime() + READY_MS;
    putForm(id, { ownerId, session: result.session, screenshot: result.screenshot, expiresAt });
    await db.update(applyQueue).set({ status: "ready", reason: null, readyUntil: new Date(expiresAt) }).where(eq(applyQueue.id, id));
    return "ready";
  });
}

/** What "Check before sending" shows: the person's own data the agent typed, and what is theirs to answer. */
export interface Review {
  id: string;
  role: string;
  company: string;
  url: string | null;
  platform: string;
  readyUntil: number;
  digest: string;
  filled: { label: string; value: string }[];
  chosen: { label: string; option: string }[];
  resume: { label: string; attached: boolean } | null;
  items: PersonItem[];
}

export async function review(ownerId: string, id: string, deps: QueueDeps = {}): Promise<Review | null> {
  const now = nowOf(deps);
  const row = await db.query.applyQueue.findFirst({ where: and(eq(applyQueue.id, id), eq(applyQueue.ownerId, ownerId)) });
  if (!row || row.status !== "ready") return null;
  const form = await getForm(id, ownerId, now.getTime());
  if (!form) {
    await db.update(applyQueue).set({ status: "waiting", reason: "expired", readyUntil: null })
      .where(and(eq(applyQueue.id, id), eq(applyQueue.status, "ready")));
    return null;
  }
  const job = await db.query.applications.findFirst({ where: and(eq(applications.id, row.applicationId), eq(applications.ownerId, ownerId)) });
  const { plan, digest, resumeAttached } = form.session;
  return {
    id, role: job?.role ?? "", company: job?.company ?? "", url: job?.url ?? null, platform: platformOf(job?.url ?? null),
    readyUntil: form.expiresAt, digest,
    filled: plan.fill.map((f) => ({ label: f.label, value: f.value })),
    chosen: plan.choose.map((c) => ({ label: c.label, option: c.option })),
    resume: plan.resume ? { label: plan.resume.label, attached: resumeAttached } : null,
    items: plan.person,
  };
}

/** The screenshot of the filled form, for its owner, while the form is open. */
export async function screenshotPath(ownerId: string, id: string, now = Date.now()): Promise<string | null> {
  return (await getForm(id, ownerId, now))?.screenshot ?? null;
}

export type SendOutcome =
  | { status: "sent"; confirmation: string }
  | { status: "unconfirmed" }
  | { status: "handoff"; reason: string; url: string }
  | { status: "missing"; labels: string[] }
  | { status: "changed" }
  | { status: "limit"; sent: number; limit: number }
  | { status: "closed" };

/**
 * Send, on the person's approval of the form they saw (`digest`) with their answers. The limit is
 * taken in the same transaction that marks the row as sending, holding the owner's settings row.
 */
export async function send(ownerId: string, id: string, approval: { digest: string; answers: Answers }, deps: QueueDeps = {}): Promise<SendOutcome> {
  const now = nowOf(deps);
  const row = await ownedRow(ownerId, id);
  if (row.status !== "ready") return { status: "closed" };
  const form = await getForm(id, ownerId, now.getTime());
  if (!form) {
    await db.update(applyQueue).set({ status: "waiting", reason: "expired", readyUntil: null })
      .where(and(eq(applyQueue.id, id), eq(applyQueue.status, "ready")));
    return { status: "closed" };
  }

  const claim = await db.transaction(async (tx) => {
    await tx.insert(applySettings).values({ ownerId }).onConflictDoNothing();
    const [settings] = await tx.select().from(applySettings).where(eq(applySettings.ownerId, ownerId)).for("update");
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(applyQueue).where(and(
      eq(applyQueue.ownerId, ownerId), inArray(applyQueue.status, COUNTED), gte(applyQueue.sendingAt, dayStart(now)),
    ));
    if (n >= settings.dailyLimit) return { ok: false as const, sent: n, limit: settings.dailyLimit };
    const [mine] = await tx.update(applyQueue).set({ status: "sending", sendingAt: now })
      .where(and(eq(applyQueue.id, id), eq(applyQueue.status, "ready"))).returning({ id: applyQueue.id });
    return mine ? { ok: true as const } : { ok: false as const, sent: n, limit: settings.dailyLimit, gone: true };
  });
  if (!claim.ok) return "gone" in claim ? { status: "closed" } : { status: "limit", sent: claim.sent, limit: claim.limit };

  const back = (status: QueueStatus, extra: Partial<typeof applyQueue.$inferInsert> = {}) =>
    db.update(applyQueue).set({ status, ...extra }).where(eq(applyQueue.id, id));

  return withLog("applyQueue.send", { ownerId, queueId: id }, async () => {
    let r: Awaited<ReturnType<typeof submitApplication>>;
    try {
      r = await submitApplication(form.session, {
        confirmedByPerson: true, session: form.session.name, digest: approval.digest, answers: approval.answers,
      });
    } catch {
      // before the click (a wrong approval, a broken browser): nothing was sent, it doesn't count
      await back("failed", { reason: "agent_error", sendingAt: null, readyUntil: null });
      await dropForm(id);
      return { status: "closed" } as SendOutcome;
    }
    if (r.status === "blocked") {
      await back("ready", { sendingAt: null });
      return r.reason === "missing"
        ? { status: "missing", labels: r.missing.map((m) => m.label) }
        : { status: "changed" };
    }
    await dropForm(id);
    if (r.status === "handoff") {
      // a handoff after the click is reported as one: the person sees the site and decides
      await back("handoff", { reason: r.reason, sendingAt: null, readyUntil: null });
      return { status: "handoff", reason: r.reason, url: r.url };
    }
    if (r.status === "unconfirmed") {
      await back("unconfirmed", { reason: "not_confirmed", readyUntil: null });
      return { status: "unconfirmed" };
    }
    await db.transaction(async (tx) => {
      await tx.update(applyQueue).set({ status: "sent", sentAt: now, confirmation: r.confirmation.slice(0, 120), readyUntil: null })
        .where(eq(applyQueue.id, id));
      const job = await tx.query.applications.findFirst({ where: and(eq(applications.id, row.applicationId), eq(applications.ownerId, ownerId)) });
      if (!job) return;
      await tx.update(applications).set({
        status: job.status === "saved" ? "applied" : job.status,
        submittedAt: job.submittedAt ?? now, appliedVia: "agent", cvId: row.cvId,
      }).where(eq(applications.id, job.id));
      const events: (typeof applicationEvents.$inferInsert)[] = [];
      if (job.status === "saved") events.push({ applicationId: job.id, ownerId, kind: "status_changed", fromStatus: "saved", toStatus: "applied", at: now });
      events.push({ applicationId: job.id, ownerId, kind: "cv_sent", at: now });
      await tx.insert(applicationEvents).values(events);
    });
    return { status: "sent", confirmation: r.confirmation };
  });
}

/** The person cancelled the check: the form closes, nothing is sent, the job waits again. */
export async function cancel(ownerId: string, id: string): Promise<void> {
  const [row] = await db.update(applyQueue).set({ status: "waiting", reason: null, readyUntil: null })
    .where(and(eq(applyQueue.id, id), eq(applyQueue.ownerId, ownerId), or(eq(applyQueue.status, "ready"), eq(applyQueue.status, "failed"))))
    .returning({ id: applyQueue.id });
  if (row) await dropForm(row.id);
}
