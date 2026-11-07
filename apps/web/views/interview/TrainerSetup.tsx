"use client";
/**
 * Interview Trainer: setting up a practice (canvas "ATS Hero Tracker v2", page "Interview trainer",
 * Desktop · Set up the practice). The job and the CV the questions come from, what the post asks
 * for, the kind of interview, the length and the options.
 *
 * Only what works today is offered (rule 10, ANTRENOR-INTERVIU-CONSTRUCTIE.md step 4): answers are
 * typed (speaking says it isn't available yet), and the interviewer's style and the English notes,
 * which are the model's, come with it.
 */
import { useState } from "react";
import type { SetupView } from "@/app/actions/interview";
import { KIND_LABEL, listWords } from "@/lib/interview/report";
import type { InterviewKind } from "@/lib/types";
import { BackLink } from "./TrainerBlocked";

export type SetupChoices = { kind: InterviewKind; minutes: 10 | 20; feedbackWhen: "each" | "end"; timer: boolean };

const KINDS: InterviewKind[] = ["recruiter", "technical", "manager"];
const WHY: Record<"chosen" | "sent" | "latest", string> = {
  chosen: "with the CV you chose",
  sent: "with the CV you sent",
  latest: "with your latest CV",
};

export interface TrainerSetupProps {
  setup: SetupView;
  initial?: Partial<SetupChoices>;
  busy: boolean;
  error: string | null;
  onChangeCv: (cvId: string) => void;
  onStart: (choices: SetupChoices) => void;
  /** opens the CV in the builder */
  onOpenCv: () => void;
}

export default function TrainerSetup({ setup, initial, busy, error, onChangeCv, onStart, onOpenCv }: TrainerSetupProps) {
  const [kind, setKind] = useState<InterviewKind>(initial?.kind ?? "recruiter");
  const [minutes, setMinutes] = useState<10 | 20>(initial?.minutes ?? 10);
  const [feedbackWhen, setFeedbackWhen] = useState<"each" | "end">(initial?.feedbackWhen ?? "each");
  const [timer, setTimer] = useState(initial?.timer ?? false);
  const [picking, setPicking] = useState(false);
  const { job, cv } = setup;
  const left = Math.max(0, setup.limit - setup.used);
  const skills = setup.items.filter((i) => i.required).slice(0, 3).map((i) => i.label);
  const note: Record<InterviewKind, string> = {
    recruiter: "Your background, why this job, and what it asks for.",
    technical: skills.length ? `The skills the job asks for: ${listWords(skills)}.` : "The skills in your CV, one by one.",
    manager: "Results you delivered, how you work with a team.",
  };

  return (
    <div className="trn trn-setup">
      <BackLink />
      <p className="trn-setup__job">
        <strong>{job.role} · {job.company}</strong>
        {cv && <> · {WHY[cv.why]}: {cv.title}</>}
        {setup.cvs.length > 1 && (
          <> <button type="button" className="trk-link trk-link--inline" aria-expanded={picking} onClick={() => setPicking((x) => !x)}>Change</button></>
        )}
      </p>
      {picking && cv && (
        <label className="trk-field trn-setup__cv">
          <span>The CV the questions come from</span>
          <select value={cv.id} onChange={(e) => { setPicking(false); onChangeCv(e.target.value); }}>
            {setup.cvs.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
      )}

      <div className="trn-setup__grid">
        <div className="trn-setup__form">
          <fieldset className="trn-fieldset">
            <legend className="trk-label">The interview</legend>
            <div className="trn-tiles">
              {KINDS.map((k) => (
                <label key={k} className={`trn-tile${kind === k ? " is-on" : ""}`}>
                  <span className="trn-tile__name">
                    <input type="radio" name="trn-kind" checked={kind === k} onChange={() => setKind(k)} /> {KIND_LABEL[k]}
                  </span>
                  <span className="trn-tile__note">{note[k]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="trn-setup__pair">
            <fieldset className="trn-fieldset">
              <legend className="trk-label">Length</legend>
              <div className="trk-choice__row">
                {([10, 20] as const).map((m) => (
                  <label key={m} className={`trk-radio trn-pill${minutes === m ? " is-on" : ""}`}>
                    <input type="radio" name="trn-length" checked={minutes === m} onChange={() => setMinutes(m)} /> {m} min
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="trn-fieldset">
              <legend className="trk-label">You answer by</legend>
              <div className="trk-choice__row">
                <label className="trk-radio trn-pill is-off">
                  <input type="radio" name="trn-mode" disabled aria-describedby="trn-speaking" /> Speaking
                </label>
                <label className="trk-radio trn-pill is-on">
                  <input type="radio" name="trn-mode" checked readOnly /> Typing
                </label>
              </div>
              <p id="trn-speaking" className="trn-note">Speaking isn’t available yet.</p>
            </fieldset>
          </div>

          <fieldset className="trn-fieldset trn-options">
            <legend className="trk-label">Options</legend>
            <label className="trn-option">
              <input type="radio" name="trn-feedback" checked={feedbackWhen === "each"} onChange={() => setFeedbackWhen("each")} />
              <span><strong>Feedback after each answer</strong> <span className="trn-muted">· learn as you go</span></span>
            </label>
            <label className="trn-option">
              <input type="radio" name="trn-feedback" checked={feedbackWhen === "end"} onChange={() => setFeedbackWhen("end")} />
              <span><strong>Feedback at the end</strong> <span className="trn-muted">· like a real interview</span></span>
            </label>
            <label className="trn-option">
              <input type="checkbox" checked={timer} onChange={(e) => setTimer(e.target.checked)} />
              <span><strong>2-minute answer timer</strong> <span className="trn-muted">· a reminder to wrap up; nothing is cut off</span></span>
            </label>
          </fieldset>
        </div>

        <aside className="trn-setup__side">
          <section className="trn-ask" aria-labelledby="trn-ask">
            <h2 id="trn-ask" className="trn-h2">What the interviewer will ask about</h2>
            {setup.items.length > 0 ? (
              <ul className="trn-ask__list">
                {setup.items.map((i) => (
                  <li key={i.label} className="trn-ask__row">
                    <span className="trn-ask__label">{i.label}{!i.required && <span className="trn-muted"> · nice to have</span>}</span>
                    <span className={`trk-chip ${i.inCv ? "trk-chip--met" : "trk-chip--partial"}`}>{i.inCv ? "in your CV" : "no proof in your CV yet"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="trn-ask__none">
                {setup.hasPost
                  ? "We found no skills we can read in this post, so the questions come from your CV."
                  : <>Add the post’s text in the <a className="trk-a" href="/app/tracker">Tracker</a> to get questions about what it asks for. Until then, the questions come from your CV.</>}
              </p>
            )}
            <p className="trn-note">Questions come only from this job and your CV.</p>
          </section>

          {setup.sessions === 0 && (
            <section className="trn-before" aria-labelledby="trn-before">
              <h2 id="trn-before" className="trn-h2">Before your first session</h2>
              <p>
                Each question is tied to a line of your CV. You type your answers, and we keep them, with what they showed,
                for 180 days. You can delete a session any time.
              </p>
            </section>
          )}

          {!setup.hasLines ? (
            <p className="trn-warn" role="status">
              Your CV has no lines to ask about yet. <button type="button" className="trk-link trk-link--inline" onClick={onOpenCv}>Add your work experience</button>, then come back.
            </p>
          ) : (
            <div className="trn-start">
              <button type="button" className="trk-btn" disabled={busy || !cv} onClick={() => onStart({ kind, minutes, feedbackWhen, timer })}>
                {busy ? "Starting…" : "Start interview"}
              </button>
              <span className="trn-note">About {minutes} minutes · {left} {left === 1 ? "session" : "sessions"} left this month</span>
            </div>
          )}
          {error && <p className="trk-error" role="alert">{error}</p>}
        </aside>
      </div>
    </div>
  );
}
