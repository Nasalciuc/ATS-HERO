"use client";
/**
 * Tracker v2: a job's card (Claude Design canvas "ATS Hero Tracker v2", Desktop · Job card). A
 * panel on the right on a computer, the whole screen on a phone. What isn't built yet (the agent,
 * its screenshots) has no place here until it is (rule 10). It is drawn with the builder's grey
 * card for what the person sets or types, and the score page's rows for what the post asks for
 * (PROVISIONAL, AGENTS.md rule 6: Liubovi draws or checks the frame).
 */
import { useEffect, useState } from "react";
import { Check, Close } from "@/components/icons";
import { ArrowUp } from "@/components/figma-icons";
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
  /** which CV the check used: "the CV you sent, …" or "your latest CV, …" */
  fitAgainst: string | null;
  /** the title of the CV that was sent, "Another file", or null */
  cvSentTitle: string | null;
  hasCv: boolean;
  events: PanelEvent[] | undefined;
  onClose: () => void;
  onStatus: (status: ApplicationStatus) => void;
  /** resolves false when it didn't save (the page shows why) */
  onSaveDetails: (patch: { notes?: string; description?: string }) => Promise<boolean>;
  onAskCv: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  /** the Interview Trainer, while its switch is on: where to practise this job, and how many times it was */
  practice?: { href: string; times: number };
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
  const [unsaved, setUnsaved] = useState<"post" | "notes" | null>(null);
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
            <span className="trk-panel__site">{PLATFORM_LABEL[platform]}</span>
            {job.url && <a href={job.url} target="_blank" rel="noreferrer noopener" className="trk-a">Open the post</a>}
          </p>
        </div>
        <button type="button" className="trk-round trk-panel__close" aria-label="Close" onClick={p.onClose}><Close size={18} aria-hidden="true" /></button>
      </div>

      <div className="trk-fcard trk-panel__status">
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
            <h3 className="trk-panel__h">
              Requirements
              <span className={`trk-state ${p.fit.required.met === p.fit.required.total ? "is-good" : "is-fair"}`}>
                {p.fit.required.met} of {p.fit.required.total} required met
              </span>
            </h3>
            {p.fitAgainst && <p className="trk-panel__against">Checked against {p.fitAgainst}</p>}
            {/* the score page's rows: a ring, what the post asks for with its own words under it, and the state in a word */}
            <ul className="trk-reqs">
              {reqs.map((r, i) => (
                <li key={i} className={`trk-req trk-req--${r.status === "met" ? "met" : "open"}`}>
                  <span className="trk-req__icon" aria-hidden="true">{r.status === "met" ? <Check size={18} /> : <Close size={18} />}</span>
                  <span className="trk-req__text">
                    <span className="trk-req__label"><strong>{r.label}</strong> <span className="trk-muted">{r.required ? "required" : "nice to have"}</span></span>
                    <span className="trk-req__quote">“{r.quote}”</span>
                  </span>
                  <span className="trk-req__state">{r.status === "met" ? "Met" : r.status === "unknown" ? "Not shown in your CV" : "Missing"}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h3 className="trk-panel__h">Requirements</h3>
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
          <div className="trk-fcard trk-panel__post">
            <label className="trk-field">
              <span>The post’s text</span>
              <textarea rows={6} value={post} maxLength={30000} onChange={(e) => setPost(e.target.value)} />
            </label>
            {unsaved === "post" && <p className="trk-error" role="alert">The post’s text didn’t save. Try again.</p>}
            {/* the way on at the right, as on the builder's pages */}
            <div className="trk-panel__actions">
              <button type="button" className="topbtn topbtn--ghost" onClick={() => { setPost(job.description ?? ""); setEditingPost(false); setUnsaved(null); }}>Cancel</button>
              <button type="button" className="topbtn topbtn--dark" onClick={async () => {
                const ok = await p.onSaveDetails({ description: post });
                setUnsaved(ok ? null : "post");
                if (ok) setEditingPost(false);
              }}>Save</button>
            </div>
          </div>
        ) : (
          <button type="button" className="trk-pill" onClick={() => setEditingPost(true)}>
            {job.description ? "Edit the post’s text" : "Add the post’s text"}
          </button>
        )}
      </section>

      {job.status === "saved" && job.url && (
        <section className="trk-panel__section" aria-label="Apply">
          <h3 className="trk-panel__h">Apply</h3>
          <p className="trk-panel__note">
            <a href={job.url} target="_blank" rel="noreferrer noopener" className="trk-a">Apply on the site</a>, then move the job to Applied.
          </p>
        </section>
      )}

      {job.status !== "saved" && (
        <section className="trk-panel__section" aria-label="CV sent">
          <h3 className="trk-panel__h">CV sent</h3>
          <p className="trk-panel__cv">
            {p.cvSentTitle ? <strong>{p.cvSentTitle}</strong> : <span className="trk-muted">Not marked yet</span>}
            <button type="button" className="trk-link" onClick={p.onAskCv}>{p.cvSentTitle ? "Change" : "What did you send?"}</button>
          </p>
        </section>
      )}

      {p.practice && (
        <section className="trk-panel__section" aria-label="Interview practice">
          <h3 className="trk-panel__h">Interview practice</h3>
          <p className="trk-panel__practice">
            <a href={p.practice.href} className="topbtn topbtn--ghost trk-panel__practice-btn">Practice this interview <ArrowUp className="topbtn__arrow--right" /></a>
            {p.practice.times > 0 && (
              <span className="trk-muted">Practiced {p.practice.times === 1 ? "once" : p.practice.times === 2 ? "twice" : `${p.practice.times} times`}</span>
            )}
          </p>
        </section>
      )}

      <section className="trk-panel__section" aria-label="History">
        <h3 className="trk-panel__h">History</h3>
        <ol className="trk-history">
          {[...(p.events ?? [])].reverse().map((e) => (
            <li key={e.id}><span className="trk-history__when">{shortDate(e.at)}</span><span>{eventText(e)}</span></li>
          ))}
        </ol>
      </section>

      <div className="trk-fcard">
        <label className="trk-field">
          <span>Notes</span>
          <textarea
            rows={3}
            value={notes}
            maxLength={400}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={async () => {
              if (notes === (job.notes ?? "")) return;
              setUnsaved((await p.onSaveDetails({ notes })) ? null : "notes");
            }}
          />
        </label>
        {unsaved === "notes" && <p className="trk-error" role="alert">Your notes didn’t save. Click outside the box to try again.</p>}
      </div>

      <div className="trk-panel__foot">
        {job.archivedAt
          ? <button type="button" className="trk-text-btn" onClick={p.onUnarchive}>Bring back</button>
          : <button type="button" className="trk-text-btn" onClick={p.onArchive}>Archive</button>}
        <button type="button" className="trk-text-btn trk-text-btn--danger" onClick={p.onDelete}>Delete</button>
      </div>
    </aside>
  );
}
