"use client";
/**
 * Interview Trainer: the home page (Claude Design canvas "ATS Hero Tracker v2", page "Interview trainer",
 * Desktop · Interview Trainer home). The jobs in Interview first, then the others, a pasted post, and
 * the past sessions. The data and the handlers are the page's (app/app/interview).
 *
 * Typing only for now, without AI (ANTRENOR-INTERVIU-CONSTRUCTIE.md, step 4): the lead says what the
 * trainer does today (rule 10), not the canvas's "AI interviewer" yet.
 */
import type { HomeJob, TrainerHome as Home } from "@/app/actions/interview";
import { STATUS_LABEL } from "@/lib/tracker";
import { KIND_LABEL, listWords } from "@/lib/interview/report";
import { agoLabel, monthDay, timesLabel, whenLabel } from "./format";

/** Past sessions and jobs link here. */
export const setupHref = (jobId: string) => `/app/interview/new?job=${encodeURIComponent(jobId)}`;
export const sessionHref = (id: string) => `/app/interview/${encodeURIComponent(id)}`;
export const reportHref = (id: string) => `/app/interview/${encodeURIComponent(id)}/report`;

/** "Beta: 18 of 20 sessions left this month", in the title panel. */
export function LimitChip({ used, limit }: { used: number; limit: number }) {
  return (
    <p className="trn-limit">
      <strong><span className="trn-limit__beta">Beta: </span>{Math.max(0, limit - used)} of {limit}</strong>{" "}
      <span className="trn-limit__long">sessions left this month</span>
      <span className="trn-limit__short">left</span>
    </p>
  );
}

function practisedLine(j: HomeJob, now: number): string {
  if (!j.practised || j.lastAt == null) return "Not practiced yet";
  const ago = agoLabel(j.lastAt, now);
  return j.practised === 1 ? `Practiced once · ${ago}` : `Practiced ${timesLabel(j.practised)} · last one ${ago}`;
}

function InterviewCard({ job, now }: { job: HomeJob; now: number }) {
  const place = [job.company, job.location, job.since != null ? `in Interview since ${monthDay(job.since)}` : "in Interview"].filter(Boolean);
  return (
    <article className="trn-card">
      <div className="trn-card__head">
        <h3 className="trn-card__role">{job.role}</h3>
        <p className="trn-card__place">{place.join(" · ")}</p>
      </div>
      <p className="trn-card__chips">
        {job.required && <span className="trk-chip trk-chip--met">{job.required.met} of {job.required.total} required</span>}
        <span className="trk-chip">{practisedLine(job, now)}</span>
      </p>
      {job.practised > 0 && (job.proven.length > 0 || job.notYet.length > 0) && (
        <p className="trn-card__proof">
          <strong>Proof given so far:</strong> {job.proven.length ? listWords(job.proven) : "none yet"}.
          {job.notYet.length > 0 && ` Not yet: ${listWords(job.notYet)}.`}
        </p>
      )}
      <div className="trn-card__actions">
        <a className="trn-btn" href={setupHref(job.id)}>{job.practised ? "Practice again" : "Practice"}</a>
        {job.lastReportId && <a className="trk-a" href={reportHref(job.lastReportId)}>Last report</a>}
      </div>
    </article>
  );
}

/** Other jobs shown before "All jobs in the Tracker". */
const OTHERS_SHOWN = 3;

export interface TrainerHomeProps {
  home: Home;
  now: number;
  paste: string;
  onPaste: (text: string) => void;
  /** opens "Add a job" with the pasted post or link */
  onAddAndPractice: () => void;
}

export default function TrainerHome({ home, now, paste, onPaste, onAddAndPractice }: TrainerHomeProps) {
  return (
    <div className="trn trn-home">
      <p className="trn-lead">
        Practice for a job’s interview with questions from its post and your CV. You type your answers, and after each
        one you see what it showed and what your CV could add.
      </p>

      {home.interviews.length > 0 ? (
        <section className="trn-section" aria-labelledby="trn-yours">
          <h2 id="trn-yours" className="trk-label">Your interviews · from the Tracker</h2>
          <div className="trn-cards">
            {home.interviews.map((j) => <InterviewCard key={j.id} job={j} now={now} />)}
          </div>
        </section>
      ) : (
        <section className="trn-empty" aria-labelledby="trn-none">
          <h2 id="trn-none">No job in Interview yet</h2>
          <p>
            When a job moves to Interview in your Tracker, it shows up here first. You can practice for any other job now, or
            paste a job post below.
          </p>
        </section>
      )}

      <div className="trn-split">
        <section className="trn-others" aria-labelledby="trn-others">
          <h2 id="trn-others" className="trn-h2">Practice for another job</h2>
          {home.others.length > 0 ? (
            <ul className="trn-others__list">
              {home.others.slice(0, OTHERS_SHOWN).map((o) => (
                <li key={o.id} className="trn-others__row">
                  <span className="trn-others__job"><strong>{o.role}</strong> · {o.company} <span className="trn-muted">· {STATUS_LABEL[o.status]}</span></span>
                  <a className="trk-a" href={setupHref(o.id)} aria-label={`Practice for ${o.role} at ${o.company}`}>Practice</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="trn-note">Your Saved and Applied jobs show up here.</p>
          )}
          <a className="trk-a trn-others__all" href="/app/tracker">All jobs in the Tracker</a>
        </section>

        <section className="trn-paste" aria-labelledby="trn-paste">
          <h2 id="trn-paste" className="trn-h2">The job isn’t in your Tracker?</h2>
          <label className="trn-paste__field">
            Paste the job post or its link
            <textarea rows={4} maxLength={30000} placeholder="Paste the text of the job post, or a link to it" value={paste} onChange={(e) => onPaste(e.target.value)} />
          </label>
          <div className="trn-paste__row">
            <button type="button" className="trn-btn trn-btn--ghost" onClick={onAddAndPractice}>Add and practice</button>
            <span className="trn-note">We add it to your Tracker as Saved.</span>
          </div>
        </section>
      </div>

      {home.past.length > 0 && (
        <section className="trn-section" aria-labelledby="trn-past">
          <h2 id="trn-past" className="trk-label">Past sessions</h2>
          <ul className="trn-past">
            {home.past.map((p) => (
              <li key={p.id} className="trn-past__row">
                <span className="trn-past__when">{whenLabel(p.at, now)}</span>
                <span className="trn-past__job"><strong>{p.role}</strong> · {p.company}</span>
                <span className="trn-past__kind">{KIND_LABEL[p.kind]} · {p.minutes} min{p.mode === "typing" ? " · typed" : ""}</span>
                {p.status === "done"
                  ? <a className="trk-a" href={reportHref(p.id)}>Report</a>
                  : <a className="trk-a" href={sessionHref(p.id)}>Continue</a>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="trn-foot">
        For practice only. ATS Hero never joins or helps during a real interview. Your answers and reports are kept for 180
        days; you can delete any session.
      </p>
    </div>
  );
}
