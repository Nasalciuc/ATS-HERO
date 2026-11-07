"use client";
/**
 * Interview Trainer: the session and the feedback after an answer (canvas "ATS Hero Tracker v2",
 * page "Interview trainer", Desktop · Live interview in its Typing state, and Desktop · Feedback).
 * Full screen, without the menu: the way out is "End interview" (§12.2, screen 3).
 *
 * Typed answers, without AI (ANTRENOR-INTERVIU-CONSTRUCTIE.md, step 4): the label at the top says
 * "Practice interview", not "AI interviewer", until a model asks the questions (rule 10). The
 * feedback is what the answer measured: the requirement and the proof from the CV with the answer's
 * own words, the counts, and the CV's numbers when the answer left them out. The STAR parts, vague
 * phrases, English notes and a stronger answer are the model's (step 5).
 */
import type { LiveSession, LiveTurn } from "@/app/actions/interview";
import { KIND_LABEL, listWords } from "@/lib/interview/report";
import type { InterviewCriterion } from "@/lib/types";
import { clock, clockWords, duration } from "./format";

/** The answer timer's reminder (IV-14): two minutes, and nothing is cut off. */
export const ANSWER_TIMER_S = 120;

/** A question in quotes; the quotes inside it become single ones. */
export const quoted = (text: string) => `“${text.replace(/“/g, "‘").replace(/”/g, "’")}”`;

type Meta = Pick<LiveSession, "role" | "company" | "kind">;

function LiveHeader({ session, status, timeLeft, busy, onEnd }: { session: Meta; status: string; timeLeft: number; busy: boolean; onEnd: () => void }) {
  return (
    <header className="trn-live__top">
      <span className="trn-badge">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>
        Practice interview
      </span>
      <span className="trn-live__job"><strong>{session.role} · {session.company}</strong> <span className="trn-muted">· {KIND_LABEL[session.kind]}</span></span>
      <span className="trn-live__grow" />
      <span className="trn-live__count">{status}</span>
      <span className="trn-live__time" role="timer" aria-label={`Time left: ${clockWords(timeLeft)}`}>
        <strong>{clock(timeLeft)}</strong> left
      </span>
      <button type="button" className="trn-btn trn-btn--ghost trn-btn--end" disabled={busy} onClick={onEnd}>
        <span>End<span className="trn-wide"> interview</span></span>
      </button>
    </header>
  );
}

export type LivePhase = "answering" | "paused" | "finished";
export type TranscriptLine = { who: "interviewer" | "you"; text: string; skipped?: boolean };

export interface TrainerLiveProps {
  session: Meta & Pick<LiveSession, "timer">;
  phase: LivePhase;
  /** 1-based */
  n: number;
  total: number;
  question: { text: string; requirement: string | null } | null;
  timeLeft: number;
  answerSeconds: number;
  /** "Try this answer again": the clock of the interview is stopped */
  retrying: boolean;
  draft: string;
  onDraft: (text: string) => void;
  transcript: TranscriptLine[];
  showTranscript: boolean;
  onToggleTranscript: () => void;
  busy: boolean;
  error: string | null;
  onSend: () => void;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onEnd: () => void;
  onReport: () => void;
}

export default function TrainerLive(p: TrainerLiveProps) {
  const timeUp = p.timeLeft <= 0;
  const status =
    p.phase === "paused" ? "Paused · the clock is stopped"
      : p.phase === "finished" ? "That was the last question"
        : p.retrying ? "Trying again · this doesn’t use time from the interview"
          : timeUp ? "Time’s up · send this answer to finish"
            : "Typing mode · write your answer as you’d say it";
  const wrapUp = p.session.timer && p.answerSeconds >= ANSWER_TIMER_S;
  return (
    <div className="trn trn-live">
      <LiveHeader session={p.session} status={p.phase === "finished" ? `${p.total} of ${p.total} answered` : `Question ${p.n} of ${p.total}`}
        timeLeft={p.timeLeft} busy={p.busy} onEnd={p.onEnd} />
      <div className="trn-live__body">
        <main className="trn-live__main">
          <p className={`trn-live__status trn-live__status--${p.phase}`} role="status" aria-live="polite">{status}</p>

          {p.question && p.phase !== "finished" && (
            <div className="trn-live__q">
              <p className="trn-live__qn">
                Question {p.n} of {p.total}
                {p.question.requirement && <> · about: <strong>{p.question.requirement}</strong></>}
              </p>
              <p className="trn-live__qtext">{quoted(p.question.text)}</p>
            </div>
          )}

          {p.phase === "answering" && (
            <label className="trn-live__answer">
              Your answer
              <textarea
                rows={7}
                maxLength={6000}
                value={p.draft}
                onChange={(e) => p.onDraft(e.target.value)}
                placeholder={p.session.timer ? "Type your answer. A reminder comes at two minutes." : "Type your answer. Take your time; there is no timer."}
              />
            </label>
          )}

          {p.phase === "answering" && p.session.timer && (
            <div className="trn-timer">
              <div className="trn-timer__row">
                <span>{wrapUp ? "Two minutes: finish your sentence and send it" : "Answer timer"}</span>
                <span><strong>{clock(Math.min(p.answerSeconds, ANSWER_TIMER_S))}</strong> of {clock(ANSWER_TIMER_S)}</span>
              </div>
              <div className="trn-timer__bar" role="progressbar" aria-label="Answer time used" aria-valuemin={0} aria-valuemax={ANSWER_TIMER_S}
                aria-valuenow={Math.min(ANSWER_TIMER_S, Math.round(p.answerSeconds))}>
                <span style={{ width: `${Math.min(100, (p.answerSeconds / ANSWER_TIMER_S) * 100)}%` }} />
              </div>
            </div>
          )}

          {p.phase === "paused" && <p className="trn-live__note">Your answers so far are saved. Resume when you’re ready{p.retrying ? "" : ", or skip this question"}.</p>}
          {p.phase === "finished" && <p className="trn-live__note">Your answers are saved. See what they showed in your report.</p>}
          {p.error && <p className="trk-error" role="alert">{p.error}</p>}

          <div className="trn-live__controls">
            {p.phase === "answering" && (
              <>
                <button type="button" className="trk-btn" disabled={p.busy || !p.draft.trim()} onClick={p.onSend}>
                  {p.busy ? "Sending…" : timeUp && !p.retrying ? "Send and finish" : "Send answer"}
                </button>
                <button type="button" className="trk-btn trk-btn--ghost trn-btn--soft" disabled={p.busy} onClick={p.onPause}>Pause</button>
              </>
            )}
            {p.phase === "paused" && (
              <>
                <button type="button" className="trk-btn" disabled={p.busy} onClick={p.onResume}>Resume</button>
                {!p.retrying && <button type="button" className="trk-btn trk-btn--ghost trn-btn--soft" disabled={p.busy} onClick={p.onSkip}>Skip this question</button>}
              </>
            )}
            {p.phase === "finished" && <button type="button" className="trk-btn" disabled={p.busy} onClick={p.onReport}>See your report</button>}
          </div>
        </main>

        <aside className="trn-live__side" aria-labelledby="trn-transcript">
          <div className="trn-live__side-head">
            <h2 id="trn-transcript" className="trn-h2">The interview so far</h2>
            <button type="button" className="trn-chip-btn" aria-pressed={!p.showTranscript} onClick={p.onToggleTranscript}>
              {p.showTranscript ? "Hide transcript" : "Show transcript"}
            </button>
          </div>
          <p className="trn-note">Your answers as you sent them. The feedback uses this text.</p>
          {p.showTranscript && (
            <ol className="trn-lines">
              {p.transcript.map((l, i) => (
                <li key={i} className="trn-line">
                  <span className={`trn-line__who trn-line__who--${l.who}`}>{l.who === "interviewer" ? "Interviewer" : "You"}</span>
                  <span className={`trn-line__text${l.skipped ? " trn-muted" : ""}`}>{l.skipped ? "Skipped" : l.text}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="trn-live__privacy">Practice only. The text above is kept with your report for 180 days.</p>
        </aside>
      </div>
    </div>
  );
}

const CRITERION: Record<InterviewCriterion["key"], string> = {
  requirement: "The requirement",
  proof: "Proof from your CV",
  situation: "Situation",
  task: "Task",
  action: "Action",
  result: "Result",
};

function criterionNote(c: InterviewCriterion, requirement: string | null): string {
  if (c.met && c.quote) return quoted(c.quote);
  if (c.key === "requirement") return `Missing: say where you used ${requirement ?? "it"}.`;
  if (c.key === "proof") return "Missing: a number or a tool from your CV line.";
  return "Missing.";
}

/** The CV line, with the part to say in bold. */
function Highlighted({ line, part }: { line: string; part: string }) {
  const i = line.indexOf(part);
  if (i < 0) return <>{line}</>;
  return <>{line.slice(0, i)}<strong>{part}</strong>{line.slice(i + part.length)}</>;
}

export interface TrainerFeedbackProps {
  session: Meta;
  n: number;
  total: number;
  question: { text: string; requirement: string | null };
  turn: LiveTurn;
  /** the requirements later questions ask about, not named yet in this session */
  ahead: string[];
  last: boolean;
  canRetry: boolean;
  timeLeft: number;
  busy: boolean;
  error: string | null;
  onNext: () => void;
  onRetry: () => void;
  onEnd: () => void;
}

export function TrainerFeedback(p: TrainerFeedbackProps) {
  const t = p.turn;
  const fillers = t.fillers.reduce((a, f) => a + f.count, 0);
  const tools = t.unused.filter((f) => !/\d/.test(f));
  return (
    <div className="trn trn-live trn-fb">
      <LiveHeader session={p.session} status={`Question ${p.n} of ${p.total} · the clock is stopped`} timeLeft={p.timeLeft} busy={p.busy} onEnd={p.onEnd} />
      <div className="trn-fb__title">
        <p className="trn-fb__kicker">Feedback · question {p.n} of {p.total}</p>
        <h1 className="trn-fb__q">{quoted(p.question.text)}</h1>
      </div>
      <div className="trn-fb__body">
        <main className="trn-fb__main">
          <section className="trn-panel" aria-labelledby="trn-fb-answer">
            <h2 id="trn-fb-answer" className="trn-h2">Your answer</h2>
            <p className="trn-fb__answer">{t.answer}</p>
          </section>

          <section className="trn-panel" aria-labelledby="trn-fb-showed">
            <h2 id="trn-fb-showed" className="trn-h2">What this answer showed</h2>
            <div className="trn-crit">
              {t.criteria.map((c) => (
                <div key={c.key} className={`trn-crit__box ${c.met ? "is-met" : "is-missing"}`}>
                  <span className="trn-crit__name">
                    {c.met
                      ? <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
                      : <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 7v6" /><path d="M12 17h.01" /></svg>}
                    {CRITERION[c.key]}
                    <span className="trk-sr">{c.met ? ": shown" : ": missing"}</span>
                  </span>
                  <span className="trn-crit__note">{criterionNote(c, p.question.requirement)}</span>
                </div>
              ))}
            </div>
            {t.numbers ? (
              <div className="trn-callout">
                <p className="trn-callout__title">Say the result. It’s already in your CV:</p>
                <p className="trn-callout__line">“<Highlighted line={t.cvLine} part={t.numbers} />”</p>
              </div>
            ) : tools.length > 0 && !t.used.length ? (
              <div className="trn-callout">
                <p className="trn-callout__title">Name what you used. It’s already in your CV:</p>
                <p className="trn-callout__line">“<Highlighted line={t.cvLine} part={tools[0]} />”</p>
              </div>
            ) : null}
          </section>
        </main>

        <aside className="trn-fb__side">
          <section className="trn-panel" aria-labelledby="trn-fb-measured">
            <h2 id="trn-fb-measured" className="trn-h2">Measured</h2>
            <div className="trn-stats">
              <div className="trn-stat"><span className="trn-stat__value">{duration(t.seconds)}</span><span className="trn-stat__label">answer length</span></div>
              <div className="trn-stat"><span className="trn-stat__value">{t.words}</span><span className="trn-stat__label">words</span></div>
              <div className="trn-stat"><span className="trn-stat__value">{fillers}</span><span className="trn-stat__label">filler words used twice or more</span></div>
            </div>
            <p className="trn-note">
              Counts from your answer, not grades.
              {t.fillers.length > 0 && ` Filler words: ${t.fillers.map((f) => `“${f.word}” ×${f.count}`).join(", ")}.`}
            </p>
          </section>

          <section className="trn-panel" aria-labelledby="trn-fb-named">
            <h2 id="trn-fb-named" className="trn-h2">What the job asks that you named</h2>
            {t.named.length > 0
              ? <p className="trn-chips">{t.named.map((l) => <span key={l} className="trk-chip trk-chip--met">{l}</span>)}</p>
              : <p className="trn-note">None of the post’s requirements, by name.</p>}
            {p.ahead.length > 0 && <p className="trn-note">Still to come in this session: {listWords(p.ahead)}.</p>}
          </section>
        </aside>
      </div>
      <footer className="trn-fb__foot">
        <button type="button" className="trk-btn" disabled={p.busy} onClick={p.onNext}>{p.last ? "See your report" : "Next question"}</button>
        {p.canRetry && <button type="button" className="trk-btn trk-btn--ghost trn-btn--soft" disabled={p.busy} onClick={p.onRetry}><span>Try <span className="trn-wide">this answer </span>again</span></button>}
        {p.canRetry && <span className="trn-note">Trying again doesn’t use time from the interview.</span>}
        {p.error && <p className="trk-error" role="alert">{p.error}</p>}
      </footer>
    </div>
  );
}
