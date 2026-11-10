"use client";
/**
 * Interview Trainer: setting up a practice (canvas "ATS Hero Tracker v2", page "Interview trainer",
 * Desktop · Set up the practice). The job and the CV the questions come from, what the post asks
 * for, the kind of interview, the length and the options.
 *
 * Only what works today is offered (rule 10): answers are typed (speaking says it isn't available
 * yet). The interviewer's style and the English notes are the model's, so they show only when the
 * interviewer can be the model (ANTRENOR-INTERVIU-CONSTRUCTIE.md, step 5). The first time, the person
 * is told what goes where and ticks that they understand; without the tick the same practice starts
 * without AI, and the button says so.
 */
import { useState } from "react";
import type { SetupView } from "@/app/actions/interview";
import { KIND_LABEL, listWords, STYLE_LABEL } from "@/lib/interview/report";
import type { InterviewKind, InterviewStyle } from "@/lib/types";
import { ArrowUp } from "@/components/figma-icons";
import { BackLink, TrainerSteps } from "./TrainerBlocked";

export type SetupChoices = {
  kind: InterviewKind;
  minutes: 10 | 20;
  feedbackWhen: "each" | "end";
  timer: boolean;
  /** with the model only: how the interviewer asks, English notes, and the tick under "Before your first session" */
  style?: InterviewStyle;
  englishNotes?: boolean;
  consent?: boolean;
};

const KINDS: InterviewKind[] = ["recruiter", "technical", "manager"];
const STYLES: InterviewStyle[] = ["friendly", "neutral", "tough"];
/** B1: each style says what it does, not just its name. */
const STYLE_NOTE: Record<InterviewStyle, string> = {
  friendly: "Warm, one follow-up question. Good for a first run.",
  neutral: "Polite and brief, like most real interviews.",
  tough: "Asks for numbers and pushes on vague answers. Never rude.",
};
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
  const [style, setStyle] = useState<InterviewStyle>(initial?.style ?? setup.lastStyle ?? "friendly");
  const [englishNotes, setEnglishNotes] = useState(initial?.englishNotes ?? true);
  const [consent, setConsent] = useState(initial?.consent ?? false);
  const [picking, setPicking] = useState(false);
  const { job, cv, ai } = setup;
  /** the interviewer will be the model: it can be, and the person agreed (before, or with the tick) */
  const withAi = Boolean(ai) && (ai?.agreed || consent);
  const left = Math.max(0, setup.limit - setup.used);
  const skills = setup.items.filter((i) => i.required).slice(0, 3).map((i) => i.label);
  const note: Record<InterviewKind, string> = {
    recruiter: "Your background, why this job, and what it asks for.",
    technical: skills.length ? `The skills the job asks for: ${listWords(skills)}.` : "The skills in your CV, one by one.",
    manager: "Results you delivered, how you work with a team.",
  };

  const before = ai && !ai.agreed ? "ai" : !ai && setup.sessions === 0 ? "plain" : null;

  return (
    <div className="trn trn-setup">
      <BackLink />
      <TrainerSteps current={0} />
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

      {/* the builder's page: a tips card at the side, the form in its grey card, the way on under it at the right */}
      <div className="trn-setup__grid">
        <aside className="trn-setup__side">
          <section className="trn-tips trn-tips--sub trn-ask" aria-labelledby="trn-ask">
            <span className="trn-tips__badge">{setup.hasPost ? "From the job post" : "From your CV"}</span>
            <h2 id="trn-ask" className="trn-tips__title">What the interviewer will ask about</h2>
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
            <p className="trn-tips__note">Questions come only from this job and your CV.</p>
          </section>
        </aside>

        <div className="trn-setup__main">
          <div className="trn-card trn-setup__form">
            <fieldset className="trn-fieldset">
              <legend className="trn-label">The interview</legend>
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

            {ai && (
              <fieldset className="trn-fieldset">
                <legend className="trn-label">The interviewer</legend>
                <div className="trn-tiles">
                  {STYLES.map((s) => (
                    <label key={s} className={`trn-tile${style === s ? " is-on" : ""}`}>
                      <span className="trn-tile__name">
                        <input type="radio" name="trn-style" checked={style === s} onChange={() => setStyle(s)} /> {STYLE_LABEL[s]}
                      </span>
                      <span className="trn-tile__note">{STYLE_NOTE[s]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="trn-setup__pair">
              <fieldset className="trn-fieldset">
                <legend className="trn-label">Length</legend>
                <div className="trk-choice__row">
                  {([10, 20] as const).map((m) => (
                    <label key={m} className={`trk-radio trn-pill${minutes === m ? " is-on" : ""}`}>
                      <input type="radio" name="trn-length" checked={minutes === m} onChange={() => setMinutes(m)} /> {m} min
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="trn-fieldset">
                <legend className="trn-label">You answer by</legend>
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
              <legend className="trn-label">Options</legend>
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
              {ai && (
                <label className="trn-option">
                  <input type="checkbox" checked={englishNotes} onChange={(e) => setEnglishNotes(e.target.checked)} />
                  <span><strong>English notes</strong> <span className="trn-muted">· up to 3 per answer, grammar and phrasing only</span></span>
                </label>
              )}
            </fieldset>
          </div>

          {/* right over the button that starts it: what to know before the first session, and the tick */}
          {before && ai ? (
            <section className="trn-mint trn-before" aria-labelledby="trn-before">
              <h2 id="trn-before" className="trn-mint__title">Before your first session</h2>
              {/* what lib/interview/prompt.ts puts in a prompt, and nothing it doesn't: keep the two in step */}
              <p>
                The interviewer is an AI, not a person. Your answers go to {ai.provider}, with the question, the line of your CV it
                is about (with that job’s title and employer) and the job you’re practicing for, so the interviewer can ask
                follow-up questions and give you feedback. Your name, your contact details and the rest of your CV aren’t sent. We
                keep your answers and the feedback for 180 days, and you can delete a session any time.
              </p>
              <label className="trn-consent">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>I understand the interviewer is an AI and my answers go to {ai.name}.</span>
              </label>
              <p className="trn-note">
                Without this you can still practice: the same questions, no follow-ups, and feedback from what your answers measured.
              </p>
            </section>
          ) : before ? (
            <section className="trn-mint trn-before" aria-labelledby="trn-before">
              <h2 id="trn-before" className="trn-mint__title">Before your first session</h2>
              <p>
                Each question is tied to a line of your CV. You type your answers, and we keep them, with what they showed,
                for 180 days. You can delete a session any time.
              </p>
            </section>
          ) : null}

          {!setup.hasLines ? (
            <p className="trn-warn" role="status">
              Your CV has no lines to ask about yet. <button type="button" className="trk-link trk-link--inline" onClick={onOpenCv}>Add your work experience</button>, then come back.
            </p>
          ) : (
            <div className="trn-start">
              <span className="trn-note">
                About {minutes} minutes · {left} {left === 1 ? "session" : "sessions"} left this month
                {ai?.agreed && <><br />The interviewer is an AI. Your answers go to {ai.provider}.</>}
              </span>
              <button type="button" className="topbtn topbtn--dark" disabled={busy || !cv}
                onClick={() => onStart(withAi ? { kind, minutes, feedbackWhen, timer, style, englishNotes, consent } : { kind, minutes, feedbackWhen, timer })}>
                {busy ? "Starting…" : ai && !withAi ? "Start without AI" : "Start interview"} <ArrowUp className="topbtn__arrow--right" />
              </button>
            </div>
          )}
          {error && <p className="trk-error" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}
