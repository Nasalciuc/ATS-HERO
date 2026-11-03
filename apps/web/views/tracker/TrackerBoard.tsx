"use client";
/**
 * Tracker v2: the board (desktop), the list (phone), "Did you hear back?", the numbers and the first
 * day. Design: the Claude Design canvas "ATS Hero Tracker v2" (Desktop · Tracker board, Phone ·
 * Tracker list, Desktop · First day), approved by Scaler on 3 Nov 2026. Presentational only: the
 * page (app/app/tracker/page.tsx) and the dev preview pass the data and the handlers.
 */
import { useState } from "react";
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
}

function metaLine(j: TrackedJob): string {
  if (j.status === "saved") return `Saved · ${shortDate(j.appliedAt)}`;
  return j.submittedAt != null ? `Sent ${shortDate(j.submittedAt)}` : `Added ${shortDate(j.appliedAt)}`;
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

function JobTile({ j, fit, onOpen }: { j: TrackedJob; fit: Fit | undefined; onOpen: (id: string) => void }) {
  return (
    <button type="button" className="trk-tile" onClick={() => onOpen(j.id)}>
      <span className="trk-tile__role">{j.role}</span>
      <span className="trk-tile__company">{j.company}{j.location ? ` · ${j.location}` : ""}</span>
      <span className="trk-tile__chips">
        <span className="trk-chip">{PLATFORM_LABEL[platformOf(j.url)]}</span>
        <FitChip fit={fit} />
      </span>
      <span className="trk-tile__meta">{metaLine(j)}</span>
    </button>
  );
}

const FOLLOW_UP_BUTTONS: [FollowUpAnswer, string][] = [
  ["interview", "Interview"],
  ["rejected", "Rejected"],
  ["not_yet", "Not yet"],
  ["no_reply", "No reply"],
];

export default function TrackerBoard({ jobs, now, fit, onOpen, onAdd, onStatus, onFollowUp }: TrackerBoardProps) {
  const [query, setQuery] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [phoneFilter, setPhoneFilter] = useState<ApplicationStatus | "all">("all");

  if (jobs.length === 0) return <FirstDay onAdd={onAdd} />;

  const due = followUpDue(jobs, now);
  const stats = trackerStats(jobs);
  const visible = showArchive ? jobs.filter((j) => j.archivedAt).map((j) => ({ ...j, archivedAt: null })) : jobs;
  const cols = boardColumns(visible, query);
  const saved = boardColumns(jobs, "").saved.length;
  const archived = archivedCount(jobs);
  const total = BOARD_STATUSES.reduce((n, s) => n + cols[s].length, 0);

  return (
    <div className="trk">
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

      {!showArchive && (
        <section className="trk-stats" aria-label="Your numbers">
          <div className="trk-stat"><span className="trk-stat__label">Sent</span><span className="trk-stat__value">{stats.sent}</span></div>
          <div className="trk-stat">
            <span className="trk-stat__label">Answered</span>
            <span className="trk-stat__value">{stats.answered} <span className="trk-stat__of">of {stats.sent}</span></span>
          </div>
          <div className="trk-stat"><span className="trk-stat__label">Interviews</span><span className="trk-stat__value">{stats.interviews}</span></div>
          <div className="trk-stat"><span className="trk-stat__label">Saved, not sent</span><span className="trk-stat__value">{saved}</span></div>
        </section>
      )}

      <div className={`trk-tools${showArchive ? " trk-tools--archive" : ""}`}>
        <label className="trk-field trk-tools__search">
          <span>Search</span>
          <input type="search" placeholder="Company or role" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {showArchive ? (
          <button type="button" className="trk-link" onClick={() => setShowArchive(false)}>Back to the board</button>
        ) : (
          archived > 0 && <button type="button" className="trk-link" onClick={() => setShowArchive(true)}>Archive ({archived})</button>
        )}
      </div>
      {showArchive && <h2 className="trk-archive-title">Archive</h2>}

      {/* desktop: the board */}
      <div className="trk-board-wrap">
        <div className="trk-board">
          {BOARD_STATUSES.map((s) => (
            <section key={s} className="trk-col" aria-label={STATUS_LABEL[s]}>
              <h2 className="trk-col__head">
                <span className={`trk-dot trk-dot--${s}`} aria-hidden="true" />
                {STATUS_LABEL[s]}
                <span className="trk-col__count">{cols[s].length}</span>
              </h2>
              {cols[s].map((j) => <JobTile key={j.id} j={j} fit={fit[j.id]} onOpen={onOpen} />)}
            </section>
          ))}
        </div>
      </div>

      {/* phone: the list */}
      <div className="trk-phone">
        <div className="trk-filters" role="group" aria-label="Show">
          <button type="button" className="trk-filter" aria-pressed={phoneFilter === "all"} onClick={() => setPhoneFilter("all")}>
            All {total}
          </button>
          {BOARD_STATUSES.filter((s) => cols[s].length > 0).map((s) => (
            <button key={s} type="button" className="trk-filter" aria-pressed={phoneFilter === s} onClick={() => setPhoneFilter(s)}>
              {STATUS_LABEL[s]} {cols[s].length}
            </button>
          ))}
        </div>
        {BOARD_STATUSES.filter((s) => cols[s].length > 0 && (phoneFilter === "all" || phoneFilter === s)).map((s) => (
          <section key={s} className="trk-group" aria-label={STATUS_LABEL[s]}>
            <h2 className="trk-group__head">{STATUS_LABEL[s]} · {cols[s].length}</h2>
            {cols[s].map((j) => (
              <div key={j.id} className="trk-row">
                <button type="button" className="trk-row__main" onClick={() => onOpen(j.id)}>
                  <span className="trk-row__role">{j.role}</span>
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
    </div>
  );
}

/** The first day: the ways to add a job that exist today (the extension and sharing come later). */
export function FirstDay({ onAdd }: { onAdd: () => void }) {
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
