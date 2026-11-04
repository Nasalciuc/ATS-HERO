/**
 * Tracker v2, the rules on data (TRACKER-V2-DESIGN.md §6): pure functions, no model, no network.
 * The screens and the Server Actions share them, and tests/tracker.test.ts holds them.
 */
import type { ApplicationStatus, ApplyPlatform } from "./types";

/** "Did you hear back?" comes this many days after sending, and again after "Not yet". */
export const FOLLOW_UP_DAYS = 14;
export const MAX_DESCRIPTION_CHARS = 30_000;
/** The tailored-vs-base comparison needs at least this many sent jobs in each group. */
export const MIN_SENT_TO_COMPARE = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export const BOARD_STATUSES: ApplicationStatus[] = ["saved", "applied", "interview", "offer", "rejected"];

/** What a job looks like to the rules: the fields the Server Actions return. */
export interface TrackedJob {
  id: string;
  company: string;
  role: string;
  url: string | null;
  location: string | null;
  description: string | null;
  notes: string | null;
  status: ApplicationStatus;
  appliedAt: number;
  submittedAt: number | null;
  followUpAt: number | null;
  archivedAt: number | null;
  cvId: string | null;
  reachedInterview?: boolean;
}

/** The ATS a link goes to, from its host. Null link: unknown. */
export function platformOf(url: string | null): ApplyPlatform {
  if (!url) return "unknown";
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "unknown";
  }
  const is = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (is("greenhouse.io")) return "greenhouse";
  if (is("lever.co")) return "lever";
  if (is("ashbyhq.com")) return "ashby";
  if (is("myworkdayjobs.com") || is("myworkdaysite.com") || is("workday.com")) return "workday";
  if (is("indeed.com") || /(^|\.)indeed\.[a-z.]+$/.test(host)) return "indeed";
  if (is("linkedin.com")) return "linkedin";
  return "other";
}

export const PLATFORM_LABEL: Record<ApplyPlatform, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  workday: "Workday",
  indeed: "Indeed",
  linkedin: "LinkedIn",
  other: "Site",
  unknown: "No link",
};

/** The job to ask about now: sent, not answered, not archived, its date come. The oldest first. */
export function followUpDue(jobs: TrackedJob[], now: number): TrackedJob | null {
  const due = jobs
    .filter((j) => j.status === "applied" && !j.archivedAt && j.submittedAt != null)
    .map((j) => ({ j, at: j.followUpAt ?? (j.submittedAt as number) + FOLLOW_UP_DAYS * DAY_MS }))
    .filter(({ at }) => at <= now)
    .sort((a, b) => a.at - b.at);
  return due[0]?.j ?? null;
}

/** Whole days since a moment, for "14 days ago". */
export function daysSince(at: number, now: number): number {
  return Math.max(0, Math.floor((now - at) / DAY_MS));
}

export interface TrackerStats {
  sent: number;
  answered: number;
  interviews: number;
}

const isSent = (j: TrackedJob) => j.submittedAt != null && j.status !== "saved";
/** Any reply, a rejection too. */
const isAnswered = (j: TrackedJob) => j.status === "interview" || j.status === "offer" || j.status === "rejected";
/** Reached an interview, even if a rejection came after. */
const isInterview = (j: TrackedJob) => Boolean(j.reachedInterview) || j.status === "interview" || j.status === "offer";

/** The numbers band. Archived jobs count: a "No reply" is a sent job that got no answer. */
export function trackerStats(jobs: TrackedJob[]): TrackerStats {
  const sent = jobs.filter(isSent);
  return {
    sent: sent.length,
    answered: sent.filter(isAnswered).length,
    interviews: sent.filter(isInterview).length,
  };
}

/** "Which CV gets answers" counts only applications sent at least this many days ago (N4, ATS-LAB-DESIGN.md). */
export const ANSWER_WAIT_DAYS = 21;

export interface CvResult {
  /** a CV's id, or "other" for a file made somewhere else */
  cvId: string;
  sent: number;
  answered: number;
  interviews: number;
  /** fewer than MIN_SENT_TO_COMPARE sent: the counts show, the comparison doesn't */
  tooFew: boolean;
}

export interface CvResults {
  /** one row per CV that was sent, the most sent first */
  rows: CvResult[];
  /** sent jobs, of any age, with no CV marked: the page asks to mark them */
  unmarked: number;
}

/**
 * "Which CV gets answers": for each CV the person sent, how many jobs, answers and interviews.
 * Only jobs sent ANSWER_WAIT_DAYS or more ago count, so this week's applications don't pull a CV down.
 * Archived jobs count, like in the numbers band.
 */
export function resultsByCv(jobs: TrackedJob[], now: number): CvResults {
  const sent = jobs.filter(isSent);
  const old = sent.filter((j) => j.cvId && now - (j.submittedAt as number) >= ANSWER_WAIT_DAYS * DAY_MS);
  const byCv = new Map<string, TrackedJob[]>();
  for (const j of old) {
    const key = j.cvId as string;
    byCv.set(key, [...(byCv.get(key) ?? []), j]);
  }
  const rows = [...byCv].map(([cvId, js]) => ({
    cvId,
    sent: js.length,
    answered: js.filter(isAnswered).length,
    interviews: js.filter(isInterview).length,
    tooFew: js.length < MIN_SENT_TO_COMPARE,
  }));
  rows.sort((a, b) => b.sent - a.sent || b.answered - a.answered || a.cvId.localeCompare(b.cvId));
  return { rows, unmarked: sent.filter((j) => !j.cvId).length };
}

/** Jobs not archived, matching the search on company or role, grouped by status. */
export function boardColumns(jobs: TrackedJob[], query: string): Record<ApplicationStatus, TrackedJob[]> {
  const q = query.trim().toLowerCase();
  const out = Object.fromEntries(BOARD_STATUSES.map((s) => [s, [] as TrackedJob[]])) as Record<ApplicationStatus, TrackedJob[]>;
  for (const j of jobs) {
    if (j.archivedAt) continue;
    if (q && !`${j.company} ${j.role}`.toLowerCase().includes(q)) continue;
    (out[j.status] ?? out.applied).push(j);
  }
  return out;
}

export const archivedCount = (jobs: TrackedJob[]) => jobs.filter((j) => j.archivedAt).length;

/** A day as "3 Nov", in English like the rest of the app (L2 brings Romanian). */
export function shortDate(at: number): string {
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * A CSV cell. A cell that starts like a formula (=, +, -, @, tab, return) gets an apostrophe, so a
 * text copied from a job board can't run as a formula in Excel or Sheets.
 */
export function csvCell(value: string | number | null | undefined): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const isoDay = (at: number | null) => (at == null ? "" : new Date(at).toISOString().slice(0, 10));

/** Every job, archived included: the export is also the person's copy of their data. */
export function trackerCsv(jobs: TrackedJob[]): string {
  const head = ["Company", "Role", "Status", "Link", "Location", "Added", "Sent", "Archived", "Notes"];
  const rows = jobs.map((j) => [
    j.company, j.role, STATUS_LABEL[j.status] ?? j.status, j.url, j.location,
    isoDay(j.appliedAt), isoDay(j.submittedAt), isoDay(j.archivedAt), j.notes,
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
