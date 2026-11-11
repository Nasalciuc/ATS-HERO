"use client";
/**
 * Tracker v2: the board (desktop), the list (phone), "Did you hear back?", the numbers and the first
 * day. What is on the page: the Claude Design canvas "ATS Hero Tracker v2" (Desktop · Tracker board,
 * Phone · Tracker list, Desktop · First day), approved by Scaler on 3 Nov 2026. How it looks: the
 * score page's and the builder's own pieces (a circle beside one sentence, the step circles, the
 * cards), since Scaler asked for the pages to look like Liubovi's (10 Nov); PROVISIONAL until she
 * draws or checks the frames (AGENTS.md rule 6). Presentational only: the page
 * (app/app/tracker/page.tsx) passes the data and the handlers.
 */
import { useState, type ReactNode } from "react";
import type { ApplicationStatus } from "@/lib/types";
import type { FollowUpAnswer } from "@/app/actions/applications";
import {
  BOARD_STATUSES, PLATFORM_LABEL, STATUS_LABEL, archivedCount, boardColumns, daysSince, followUpDue,
  platformOf, shortDate, trackerStats, type TrackedJob,
} from "@/lib/tracker";

export type Fit = { met: number; total: number };

/** The canvas's plus: 2.2 wide, bolder than the icon set's. */
export function PlusBold({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
  );
}

export interface TrackerBoardProps {
  jobs: TrackedJob[];
  now: number;
  /** the post's required items the CV meets, per job id, when both the post's text and a CV exist */
  fit: Record<string, Fit | undefined>;
  onOpen: (id: string) => void;
  onAdd: () => void;
  onStatus: (id: string, status: ApplicationStatus) => void;
  onFollowUp: (id: string, answer: FollowUpAnswer) => void;
  /** under the numbers: what the daily search does */
  notices?: ReactNode;
  /** under the jobs: "Which CV gets answers" */
  afterBoard?: ReactNode;
  /** the first day's "Find jobs every morning", when the daily search is on */
  onSearch?: () => void;
}

/** Each stage's picture, as the builder's steps have theirs. */
const STAGE_EMOJI: Record<ApplicationStatus, string> = { saved: "📌", applied: "📨", interview: "🎤", offer: "🎉", rejected: "📕" };

/** Added by today's daily search. */
const newToday = (j: TrackedJob, now: number) => j.source === "job_search" && j.status === "saved" && daysSince(j.appliedAt, now) === 0;

function metaLine(j: TrackedJob): string {
  if (j.status === "saved") return `${j.source === "job_search" ? "Daily search" : "Saved"} · ${shortDate(j.appliedAt)}`;
  return j.submittedAt != null ? `Sent ${shortDate(j.submittedAt)}` : `Added ${shortDate(j.appliedAt)}`;
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The numbers in one sentence, as the score page says its result in one. Counts only: sent, answered
 * (a rejection is an answer too), reached an interview, saved and not sent.
 */
export function numbersLead(s: { sent: number; answered: number; interviews: number }, saved: number): string {
  const savedJobs = `${count(saved, "saved job")} ${saved === 1 ? "is" : "are"}`;
  if (s.sent === 0) return saved > 0 ? `Nothing sent yet. ${savedJobs} waiting.` : "Nothing sent yet.";
  const waiting = saved > 0 ? `${savedJobs} not sent yet.` : "";
  const answers = s.answered === 0
    ? "No answer yet."
    : `${s.answered} got an answer${s.interviews > 0 ? `, ${s.interviews} reached an interview` : ""}.`;
  return [`You sent ${count(s.sent, "application")}.`, answers, waiting].filter(Boolean).join(" ");
}

function FitChip({ fit }: { fit: Fit | undefined }) {
  if (!fit || fit.total === 0) return null;
  const all = fit.met === fit.total;
  return (
    <span className={`trk-chip ${all ? "trk-chip--met" : "trk-chip--partial"}`}>
      {fit.met} of {fit.total} required
    </span>
  );
}

function JobTile({ j, fit, now, onOpen }: { j: TrackedJob; fit: Fit | undefined; now: number; onOpen: (id: string) => void }) {
  return (
    <button type="button" className="trk-tile" onClick={() => onOpen(j.id)}>
      <span className="trk-tile__top">
        <span className="trk-tile__role">{j.role}</span>
        {newToday(j, now) && <span className="trk-chip trk-chip--new">New today</span>}
      </span>
      <span className="trk-tile__company">{j.company}{j.location ? ` · ${j.location}` : ""}</span>
      <FitChip fit={fit} />
      <span className="trk-tile__meta"><span>{PLATFORM_LABEL[platformOf(j.url)]}</span><span>{metaLine(j)}</span></span>
    </button>
  );
}

const FOLLOW_UP_BUTTONS: [FollowUpAnswer, string][] = [
  ["interview", "Interview"],
  ["rejected", "Rejected"],
  ["not_yet", "Not yet"],
  ["no_reply", "No reply"],
];

export default function TrackerBoard({ jobs, now, fit, onOpen, onAdd, onStatus, onFollowUp, notices, afterBoard, onSearch }: TrackerBoardProps) {
  const [query, setQuery] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [phoneFilter, setPhoneFilter] = useState<ApplicationStatus | "all">("all");

  if (jobs.length === 0) return <FirstDay onAdd={onAdd} onSearch={onSearch} />;

  const due = followUpDue(jobs, now);
  const stats = trackerStats(jobs);
  const visible = showArchive ? jobs.filter((j) => j.archivedAt).map((j) => ({ ...j, archivedAt: null })) : jobs;
  const cols = boardColumns(visible, query);
  const saved = boardColumns(jobs, "").saved.length;
  const archived = archivedCount(jobs);
  const total = BOARD_STATUSES.reduce((n, s) => n + cols[s].length, 0);
  // the chosen status's last job moved away: its chip is gone, so the list shows everything again
  const shown = phoneFilter !== "all" && cols[phoneFilter].length === 0 ? "all" : phoneFilter;

  return (
    <div className="trk">
      {/* the score page's head: a circle with the count, and the numbers in one sentence */}
      {!showArchive && (
        <section className="trk-head" aria-label="Your numbers">
          <p className="trk-count">
            {stats.sent > 0 ? (
              <>
                <span className="trk-count__value">{stats.answered}<span className="trk-count__of"> / {stats.sent}</span></span>
                <span className="trk-count__label">answered</span>
              </>
            ) : (
              <>
                <span className="trk-count__value">{saved}</span>
                <span className="trk-count__label">saved</span>
              </>
            )}
          </p>
          <p className="trk-head__lead">{numbersLead(stats, saved)}</p>
        </section>
      )}

      {due && !showArchive && (
        <section className="trk-ask" aria-label="Did you hear back?">
          <p className="trk-ask__text">
            <strong>Did you hear back from {due.company}?</strong>{" "}
            <span className="trk-wide">You sent your application for {due.role} {daysSince(due.submittedAt as number, now)} days ago.</span>
            <span className="trk-narrow">You applied {daysSince(due.submittedAt as number, now)} days ago.</span>
          </p>
          <div className="trk-ask__buttons">
            {FOLLOW_UP_BUTTONS.map(([answer, label]) => (
              <button key={answer} type="button" className="trk-pill" onClick={() => onFollowUp(due.id, answer)}>
                {label}
              </button>
            ))}
          </div>
        </section>
      )}
      {!showArchive && notices}

      <div className={`trk-tools${showArchive ? " trk-tools--archive" : ""}`}>
        <label className="trk-searchbox">
          <span className="trk-sr">Search</span>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input type="search" placeholder="Search by company or role" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {showArchive ? (
          <button type="button" className="trk-pill" onClick={() => setShowArchive(false)}>Back to the board</button>
        ) : (
          archived > 0 && <button type="button" className="trk-pill" onClick={() => setShowArchive(true)}>Archive ({archived})</button>
        )}
      </div>
      {showArchive && <h2 className="trk-archive-title">Archive</h2>}

      {/* desktop: the board, each stage under its circle, as the builder's steps */}
      <div className="trk-board-wrap">
        <div className="trk-board">
          {BOARD_STATUSES.map((s) => (
            <section key={s} className="trk-col" aria-label={STATUS_LABEL[s]}>
              <h2 className="trk-col__head">
                <span className={`trk-col__icon trk-col__icon--${s}`} aria-hidden="true">{STAGE_EMOJI[s]}</span>
                <span className="trk-col__name">{STATUS_LABEL[s]}</span>
                <span className="trk-col__count">{cols[s].length}</span>
              </h2>
              {cols[s].map((j) => <JobTile key={j.id} j={j} fit={fit[j.id]} now={now} onOpen={onOpen} />)}
            </section>
          ))}
        </div>
      </div>

      {/* phone: the list */}
      <div className="trk-phone">
        <div className="trk-filters" role="group" aria-label="Show">
          <button type="button" className="trk-filter" aria-pressed={shown === "all"} onClick={() => setPhoneFilter("all")}>
            All {total}
          </button>
          {BOARD_STATUSES.filter((s) => cols[s].length > 0).map((s) => (
            <button key={s} type="button" className="trk-filter" aria-pressed={shown === s} onClick={() => setPhoneFilter(s)}>
              {STATUS_LABEL[s]} {cols[s].length}
            </button>
          ))}
        </div>
        {BOARD_STATUSES.filter((s) => cols[s].length > 0 && (shown === "all" || shown === s)).map((s) => (
          <section key={s} className="trk-group" aria-label={STATUS_LABEL[s]}>
            <h2 className="trk-group__head">
              <span className={`trk-col__icon trk-col__icon--${s}`} aria-hidden="true">{STAGE_EMOJI[s]}</span>
              {STATUS_LABEL[s]} · {cols[s].length}
            </h2>
            {cols[s].map((j) => (
              <div key={j.id} className="trk-row">
                <button type="button" className="trk-row__main" onClick={() => onOpen(j.id)}>
                  <span className="trk-row__role">{j.role}{newToday(j, now) && <span className="trk-chip trk-chip--new">New today</span>}</span>
                  <span className="trk-row__company">{j.company} · {PLATFORM_LABEL[platformOf(j.url)]}</span>
                </button>
                <label className="trk-row__status">
                  <span className="trk-sr">Status for {j.role} at {j.company}</span>
                  <select value={j.status} onChange={(e) => onStatus(j.id, e.target.value as ApplicationStatus)}>
                    {BOARD_STATUSES.map((o) => <option key={o} value={o}>{STATUS_LABEL[o]}</option>)}
                  </select>
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                </label>
              </div>
            ))}
          </section>
        ))}
      </div>

      {!showArchive && afterBoard}
    </div>
  );
}

/** The first day: the ways to add a job that exist today (the extension and sharing come later). */
export function FirstDay({ onAdd, onSearch }: { onAdd: () => void; onSearch?: () => void }) {
  return (
    <div className="trk-first">
      <p className="trk-first__lead">
        Keep every job you want in one place: what it asks for, which CV you sent and what happened next. Add your first one:
      </p>
      <div className="trk-first__ways">
        <button type="button" className="trk-way" onClick={onAdd}>
          <span className="trk-way__icon trk-way__icon--dark" aria-hidden="true"><PlusBold /></span>
          <span className="trk-way__text">
            <strong>Paste a job link</strong>
            <span>From any site. Add the post’s text to see what it asks for.</span>
          </span>
        </button>
        {onSearch && (
          <button type="button" className="trk-way" onClick={onSearch}>
            <span className="trk-way__icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            </span>
            <span className="trk-way__text">
              <strong>Find new jobs every morning</strong>
              <span>A daily search puts the ones that fit your CV best in Saved.</span>
            </span>
          </button>
        )}
        <a href="/app/jobfit" className="trk-way">
          <span className="trk-way__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" /></svg>
          </span>
          <span className="trk-way__text">
            <strong>Compare your CV with a post first</strong>
            <span>Check Job Fit shows what it asks for; then add the job here.</span>
          </span>
        </a>
      </div>
    </div>
  );
}
