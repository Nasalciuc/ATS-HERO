"use client";
/**
 * Interview Trainer: the home page (Claude Design canvas "ATS Hero Tracker v2", page "Interview trainer",
 * Desktop · Interview Trainer home). The jobs in Interview first, then the others, a pasted post, and
 * the past sessions. The data and the handlers are the page's (app/app/interview).
 *
 * The lead says what the trainer does today (rule 10): answers are typed, and the interviewer is "an
 * AI" only when the model can be reached right now (ANTRENOR-INTERVIU-CONSTRUCTIE.md, step 5).
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

/**
 * A job to practice for, as a row of the score page: a picture in a ring (green once it has been
 * practised), the job, where the practice stands in a word, and the way in at the right.
 */
function InterviewRow({ job, now }: { job: HomeJob; now: number }) {
  const place = [job.company, job.location, job.since != null ? `in Interview since ${monthDay(job.since)}` : "in Interview"].filter(Boolean);
  return (
    <li className="trn-job">
      <span className={`trn-job__icon${job.practised ? " is-done" : ""}`} aria-hidden="true">💼</span>
      <div className="trn-job__main">
        <h3 className="trn-job__role">{job.role}</h3>
        <p className="trn-job__place">{place.join(" · ")}</p>
        {job.practised > 0 && (job.proven.length > 0 || job.notYet.length > 0) && (
          <p className="trn-job__proof">
            <strong>Proof given so far:</strong> {job.proven.length ? listWords(job.proven) : "none yet"}.
            {job.notYet.length > 0 && ` Not yet: ${listWords(job.notYet)}.`}
          </p>
        )}
      </div>
      <p className="trn-job__state">
        <span className={`trn-state ${job.practised ? "is-good" : "is-none"}`}>{practisedLine(job, now)}</span>
        {job.required && <span className="trn-job__req">{job.required.met} of {job.required.total} required</span>}
      </p>
      <div className="trn-job__actions">
        {job.lastReportId && <a className="trk-a" href={reportHref(job.lastReportId)}>Last report</a>}
        <a className="topbtn topbtn--dark" href={setupHref(job.id)}>{job.practised ? "Practice again" : "Practice"}</a>
      </div>
    </li>
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
        {home.ai
          ? "Practice with an AI interviewer that knows the job and your CV. You type your answers; it asks follow-up questions and gives you feedback on every answer."
          : "Practice for a job’s interview with questions from its post and your CV. You type your answers, and after each one you see what it showed and what your CV could add."}
      </p>

      {home.interviews.length > 0 ? (
        <section className="trn-section" aria-labelledby="trn-yours">
          <h2 id="trn-yours" className="trn-fb__h">Your interviews <span className="trn-muted">· from the Tracker</span></h2>
          <ul className="trn-jobs">
            {home.interviews.map((j) => <InterviewRow key={j.id} job={j} now={now} />)}
          </ul>
        </section>
      ) : (
        <section className="trn-tips trn-tips--sub trn-empty" aria-labelledby="trn-none">
          <h2 id="trn-none" className="trn-tips__title">No job in Interview yet</h2>
          <p className="trn-tips__note">
            When a job moves to Interview in your Tracker, it shows up here first. You can practice for any other job now, or
            paste a job post below.
          </p>
        </section>
      )}

      <div className="trn-split">
        <section className="trn-others" aria-labelledby="trn-others">
          <h2 id="trn-others" className="trn-fb__h">Practice for another job</h2>
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

        <section className="trn-fcard trn-paste" aria-labelledby="trn-paste">
          <h2 id="trn-paste" className="trn-h2">The job isn’t in your Tracker?</h2>
          <label className="trn-paste__field">
            <span className="trn-label">Paste the job post or its link</span>
            <textarea rows={4} maxLength={30000} placeholder="Paste the text of the job post, or a link to it" value={paste} onChange={(e) => onPaste(e.target.value)} />
          </label>
          <div className="trn-paste__row">
            <button type="button" className="topbtn topbtn--ghost" onClick={onAddAndPractice}>Add and practice</button>
            <span className="trn-note">We add it to your Tracker as Saved.</span>
          </div>
        </section>
      </div>

      {home.past.length > 0 && (
        <section className="trn-section" aria-labelledby="trn-past">
          <h2 id="trn-past" className="trn-fb__h">Past sessions</h2>
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
