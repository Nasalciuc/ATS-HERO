"use client";
/**
 * Tracker v2: a job's card (Claude Design canvas "ATS Hero Tracker v2", Desktop · Job card). A
 * panel on the right on a computer, the whole screen on a phone. What isn't built yet (the agent,
 * its screenshots) has no place here until it is (rule 10).
 */
import { useEffect, useState } from "react";
import { Check, Close } from "@/components/icons";
import type { ApplicationStatus } from "@/lib/types";
import type { JobFitReport } from "@/lib/job-fit";
import { BOARD_STATUSES, PLATFORM_LABEL, STATUS_LABEL, platformOf, shortDate, type TrackedJob } from "@/lib/tracker";

export interface PanelEvent {
  id: string;
  kind: string;
  fromStatus: string | null;
  toStatus: string | null;
  at: number;
}

export interface JobPanelProps {
  job: TrackedJob;
  /** Job Fit on the post's text and the CV (the one sent, else the latest); null when one is missing */
  fit: JobFitReport | null;
  /** the title of the CV that was sent, "Another file", or null */
  cvSentTitle: string | null;
  hasCv: boolean;
  events: PanelEvent[] | undefined;
  onClose: () => void;
  onStatus: (status: ApplicationStatus) => void;
  onSaveDetails: (patch: { notes?: string; description?: string }) => Promise<unknown>;
  onAskCv: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}

function eventText(e: PanelEvent): string {
  const to = e.toStatus ? STATUS_LABEL[e.toStatus as ApplicationStatus] ?? e.toStatus : "";
  switch (e.kind) {
    case "created": return e.toStatus === "saved" ? "Saved" : `Added as ${to}`;
    case "status_changed": return `Moved to ${to}`;
    case "archived": return "Archived";
    case "unarchived": return "Brought back from the archive";
    case "cv_sent": return "Marked which CV was sent";
    case "follow_up_snoozed": return "Not heard back yet: we ask again in 14 days";
    default: return e.kind;
  }
}

export default function JobPanel(p: JobPanelProps) {
  const { job } = p;
  const [notes, setNotes] = useState(job.notes ?? "");
  const [post, setPost] = useState(job.description ?? "");
  const [editingPost, setEditingPost] = useState(false);
  useEffect(() => { setNotes(job.notes ?? ""); setPost(job.description ?? ""); }, [job.id, job.notes, job.description]);

  const platform = platformOf(job.url);
  const reqs = p.fit?.requirements ?? [];

  return (
    <aside className="trk-panel" aria-label={`${job.role} at ${job.company}`}>
      {/* phone: the card is a whole page, so it goes back instead of closing */}
      <button type="button" className="trk-panel__back" onClick={p.onClose}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        Tracker
      </button>
      <div className="trk-panel__head">
        <div className="trk-panel__title">
          <h2 className="trk-panel__role">{job.role}</h2>
          <p className="trk-panel__company">{job.company}{job.location ? ` · ${job.location}` : ""}</p>
          <p className="trk-panel__links">
            <span className="trk-chip">{PLATFORM_LABEL[platform]}</span>
            {job.url && <a href={job.url} target="_blank" rel="noreferrer noopener" className="trk-a">Open the post</a>}
          </p>
        </div>
        <button type="button" className="trk-round trk-panel__close" aria-label="Close" onClick={p.onClose}><Close size={18} aria-hidden="true" /></button>
      </div>

      <div className="trk-panel__status">
        <label className="trk-field">
          <span>Status</span>
          <select value={job.status} onChange={(e) => p.onStatus(e.target.value as ApplicationStatus)}>
            {BOARD_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <p className="trk-panel__dates">
          Added {shortDate(job.appliedAt)}{job.submittedAt != null ? ` · Sent ${shortDate(job.submittedAt)}` : ""}
        </p>
      </div>

      <section className="trk-panel__section" aria-label="Requirements">
        {p.fit && reqs.length > 0 ? (
          <>
            <h3 className="trk-label">Requirements · {p.fit.required.met} of {p.fit.required.total} required met</h3>
            <ul className="trk-reqs">
              {reqs.map((r, i) => (
                <li key={i} className="trk-req">
                  {r.status === "met" ? (
                    <Check size={18} role="img" className="trk-req__icon trk-req__icon--met" aria-label="Met" />
                  ) : (
                    <Close size={18} role="img" className="trk-req__icon trk-req__icon--missing" aria-label={r.status === "unknown" ? "Not shown in your CV" : "Missing"} />
                  )}
                  <span className="trk-req__text">
                    <span><strong>{r.label}</strong> <span className="trk-muted">{r.required ? "required" : "nice to have"}</span></span>
                    <span className="trk-req__quote">“{r.quote}”</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h3 className="trk-label">Requirements</h3>
            <p className="trk-panel__note">
              {!job.description
                ? "Add the post’s text to see what it asks for, checked against your CV."
                : !p.hasCv
                  ? "Save a CV in ATS Hero to check it against this post."
                  : "We found no requirements we can check in this post: no skills from our list and no years of experience."}
            </p>
          </>
        )}
        {editingPost ? (
          <div className="trk-panel__post">
            <label className="trk-field">
              <span>The post’s text</span>
              <textarea rows={6} value={post} maxLength={30000} onChange={(e) => setPost(e.target.value)} />
            </label>
            <div className="trk-panel__actions">
              <button type="button" className="topbtn topbtn--dark" onClick={async () => { await p.onSaveDetails({ description: post }); setEditingPost(false); }}>Save</button>
              <button type="button" className="topbtn topbtn--ghost" onClick={() => { setPost(job.description ?? ""); setEditingPost(false); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" className="trk-link" onClick={() => setEditingPost(true)}>
            {job.description ? "Edit the post’s text" : "Add the post’s text"}
          </button>
        )}
      </section>

      {job.status === "saved" && job.url && (
        <section className="trk-panel__section" aria-label="Apply">
          <h3 className="trk-label">Apply</h3>
          <p className="trk-panel__note">
            <a href={job.url} target="_blank" rel="noreferrer noopener" className="trk-a">Apply on the site</a>, then move the job to Applied.
          </p>
        </section>
      )}

      {job.status !== "saved" && (
        <section className="trk-panel__section" aria-label="CV sent">
          <h3 className="trk-label">CV sent</h3>
          <p className="trk-panel__cv">
            {p.cvSentTitle ? <strong>{p.cvSentTitle}</strong> : <span className="trk-muted">Not marked yet</span>}
            <button type="button" className="trk-link" onClick={p.onAskCv}>{p.cvSentTitle ? "Change" : "What did you send?"}</button>
          </p>
        </section>
      )}

      <section className="trk-panel__section" aria-label="History">
        <h3 className="trk-label">History</h3>
        <ol className="trk-history">
          {[...(p.events ?? [])].reverse().map((e) => (
            <li key={e.id}><span className="trk-history__when">{shortDate(e.at)}</span><span>{eventText(e)}</span></li>
          ))}
        </ol>
      </section>

      <label className="trk-field">
        <span>Notes</span>
        <textarea
          rows={3}
          value={notes}
          maxLength={400}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => { if (notes !== (job.notes ?? "")) void p.onSaveDetails({ notes }); }}
        />
      </label>

      <div className="trk-panel__foot">
        {job.archivedAt
          ? <button type="button" className="trk-text-btn" onClick={p.onUnarchive}>Bring back</button>
          : <button type="button" className="trk-text-btn" onClick={p.onArchive}>Archive</button>}
        <button type="button" className="trk-text-btn trk-text-btn--danger" onClick={p.onDelete}>Delete</button>
      </div>
    </aside>
  );
}
