"use client";
/**
 * Interview Trainer: the session and the feedback after an answer (canvas "ATS Hero Tracker v2",
 * page "Interview trainer", Desktop · Live interview in its Typing state, and Desktop · Feedback).
 * Full screen, without the menu: the way out is "End interview" (§12.2, screen 3).
 *
 * Typed answers. What a screen says follows what the session is (rule 10):
 * - without the model, the label at the top is "Practice interview", and the feedback is what the
 *   answer measured: the requirement and the proof from the CV with the answer's own words, the
 *   counts, and the CV's numbers when the answer left them out;
 * - with the model (ANTRENOR-INTERVIU-CONSTRUCTIE.md, step 5), the label is "AI interviewer" and stays
 *   there, the interviewer's first line says it is an AI (AI Act 50(1)), it asks follow-ups, and the
 *   feedback adds the model's part, each piece with the person's words: the four parts of the answer,
 *   vague phrases with the question that makes them concrete, English notes with "I said it right",
 *   and a stronger answer marked "Made with AI. Check it." No score anywhere (IV-6).
 */
import type { LiveSession, LiveTurn } from "@/app/actions/interview";
import { KIND_LABEL, listWords, STYLE_LABEL } from "@/lib/interview/report";
import type { InterviewCriterion, InterviewKind } from "@/lib/types";
import { clock, clockWords, duration, segments } from "./format";

/** The answer timer's reminder (IV-14): two minutes, and nothing is cut off. */
export const ANSWER_TIMER_S = 120;

/** A question in quotes; the quotes inside it become single ones. */
export const quoted = (text: string) => `“${text.replace(/“/g, "‘").replace(/”/g, "’")}”`;

type Meta = Pick<LiveSession, "role" | "company" | "kind" | "ai" | "style">;

function LiveHeader({ session, status, timeLeft, busy, onEnd }: { session: Meta; status: string; timeLeft: number; busy: boolean; onEnd: () => void }) {
  return (
    <header className="trn-live__top">
      <span className="trn-badge">
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>
        {session.ai ? "AI interviewer" : "Practice interview"}
      </span>
      <span className="trn-live__job">
        <strong>{session.role} · {session.company}</strong>{" "}
        <span className="trn-muted">· {KIND_LABEL[session.kind]}{session.ai && ` · ${STYLE_LABEL[session.style]}`}</span>
      </span>
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

/** thinking: the answer is in, and the interviewer decides whether to ask more */
export type LivePhase = "answering" | "thinking" | "paused" | "finished";
export type TranscriptLine = { who: "interviewer" | "you"; text: string; skipped?: boolean };

export interface TrainerLiveProps {
  session: Meta & Pick<LiveSession, "timer">;
  phase: LivePhase;
  /** 1-based */
  n: number;
  total: number;
  question: { text: string; requirement: string | null } | null;
  /** the question on screen is the interviewer's follow-up on the last answer */
  followUp?: boolean;
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
        : p.phase === "thinking" ? "Thinking…"
          : p.retrying ? "Trying again · this doesn’t use time from the interview"
            : timeUp ? "Time’s up · send this answer to finish"
              : p.session.ai ? "Typing mode · the interviewer reads your answer"
                : "Typing mode · write your answer as you’d say it";
  const wrapUp = p.session.timer && p.answerSeconds >= ANSWER_TIMER_S;
  return (
    <div className="trn trn-live">
      {/* the way out stays open while the interviewer reads an answer: the answer is already saved */}
      <LiveHeader session={p.session} status={p.phase === "finished" ? `${p.total} of ${p.total} answered` : `Question ${p.n} of ${p.total}`}
        timeLeft={p.timeLeft} busy={p.busy && p.phase !== "thinking"} onEnd={p.onEnd} />
      <div className="trn-live__body">
        <main className="trn-live__main">
          <p className={`trn-live__status trn-live__status--${p.phase}`} role="status" aria-live="polite">{status}</p>

          {p.question && p.phase !== "finished" && (
            <div className="trn-live__q">
              <p className="trn-live__qn">
                {p.followUp ? "Follow-up · question" : "Question"} {p.n} of {p.total}
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

          {p.phase === "thinking" && <p className="trn-live__note">Your answer is saved. The clock is stopped while the interviewer reads it.</p>}
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
                {(!p.retrying || p.followUp) && <button type="button" className="trk-btn trk-btn--ghost trn-btn--soft" disabled={p.busy} onClick={p.onSkip}>Skip this question</button>}
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
/** What a missing part of an answer would say. Ours, the same for everyone: the model only finds the part or doesn't. */
const MISSING: Record<"situation" | "task" | "action" | "result", string> = {
  situation: "Missing: where this was, and what the problem was.",
  task: "Missing: what was yours to do.",
  action: "Missing: what you did yourself, step by step.",
  result: "Missing: what changed, in numbers if you have them.",
};
export const LISTENS_FOR: Record<InterviewKind, string> = {
  recruiter: "What a recruiter listens for",
  technical: "What a technical interviewer listens for",
  manager: "What a hiring manager listens for",
};

export function criterionNote(c: InterviewCriterion, requirement: string | null, used: string[] = []): string {
  if (c.met && c.quote) return quoted(c.quote);
  if (c.key === "requirement") return c.met ? "Named in your answer." : `Missing: say where you used ${requirement ?? "it"}.`;
  // a fact said another way than the CV writes it ("twelve hours") has no sentence to show
  if (c.key === "proof") return c.met ? `You used: ${used.join(", ")}.` : "Missing: a number or a tool from your CV line.";
  return MISSING[c.key];
}

/**
 * What the answer measured, for showing: when the proof stands in the very sentence that names the
 * requirement, the sentence is shown once, and the proof says which of the CV's facts it used.
 */
export function measuredForShow(criteria: InterviewCriterion[]): InterviewCriterion[] {
  const named = criteria.find((c) => c.key === "requirement" && c.met)?.quote;
  return criteria.map((c) => (c.key === "proof" && c.met && c.quote && c.quote === named ? { ...c, quote: null } : c));
}

/** The CV line, with the part to say in bold. */
function Highlighted({ line, part }: { line: string; part: string }) {
  const i = line.indexOf(part);
  if (i < 0) return <>{line}</>;
  return <>{line.slice(0, i)}<strong>{part}</strong>{line.slice(i + part.length)}</>;
}

/** What marks an answer: the vague phrases and, while they stand, the English notes' words. */
export const marksOf = (ai: LiveTurn["ai"]) => [
  ...(ai?.vague ?? []).map((v) => ({ text: v.phrase, mark: "vague" as const })),
  ...(ai?.english ?? []).map((n) => ({ text: n.quote, mark: "english" as const })),
];

/** An answer with its marked phrases in place. The marks have words under the answer too: colour is never the only sign. */
export function MarkedAnswer({ text, ai }: { text: string; ai: LiveTurn["ai"] }) {
  return (
    <>
      {segments(text, marksOf(ai)).map((s, i) => (s.mark ? <mark key={i} className={`trn-mark trn-mark--${s.mark}`}>{s.text}</mark> : <span key={i}>{s.text}</span>))}
    </>
  );
}

/** One criterion's box: found, with the person's words; or missing, with what to say. */
function CriterionBox({ c, requirement, used }: { c: InterviewCriterion; requirement: string | null; used: string[] }) {
  return (
    <div className={`trn-crit__box ${c.met ? "is-met" : "is-missing"}`}>
      <span className="trn-crit__name">
        {c.met
          ? <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
          : <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 7v6" /><path d="M12 17h.01" /></svg>}
        {CRITERION[c.key]}
        <span className="trk-sr">{c.met ? ": shown" : ": missing"}</span>
      </span>
      <span className="trn-crit__note">{criterionNote(c, requirement, used)}</span>
    </div>
  );
}

/** The English notes that still stand on one answer, each with "I said it right" (B2). */
export function EnglishNotes({ ai, busy, onDismiss }: { ai: NonNullable<LiveTurn["ai"]>; busy: boolean; onDismiss: (index: number) => void }) {
  return (
    <>
      {ai.english.length > 0 ? (
        <ul className="trn-notes">
          {ai.english.map((n) => (
            <li key={n.index} className="trn-notes__item">
              <p className="trn-notes__fix"><del>{n.quote}</del> <span aria-hidden="true">→</span><span className="trk-sr"> better: </span> <strong>{n.better}</strong></p>
              {n.why && <p className="trn-note">{n.why}</p>}
              <button type="button" className="trn-chip-btn" disabled={busy} onClick={() => onDismiss(n.index)}>I said it right</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="trn-note">{ai.dismissed ? "No notes left on this answer." : "No notes on this answer."}</p>
      )}
      <p className="trn-notes__foot">
        Grammar and wording only, from what you typed.
        {ai.english.length > 0 && " If a note is wrong, choose “I said it right”: it goes, and it isn’t counted."}
        {ai.dismissed > 0 && ` You marked ${ai.dismissed} ${ai.dismissed === 1 ? "note" : "notes"} as “I said it right”.`}
      </p>
    </>
  );
}

/**
 * "A stronger answer", or why there is none to show. Null when the model gave none. `id` names its
 * heading (a report has one per question); `sub`: under a question's own heading, in a report.
 */
export function StrongerAnswer({ ai, id = "trn-fb-stronger", sub = false }: { ai: NonNullable<LiveTurn["ai"]>; id?: string; sub?: boolean }) {
  if (!ai.stronger && !ai.strongerRefused) return null;
  const Heading = sub ? "h3" : "h2";
  return (
    <section className="trn-panel trn-panel--ai" aria-labelledby={id}>
      <div className="trn-panel__head">
        <Heading id={id} className="trn-h2">A stronger answer</Heading>
        {ai.stronger && <span className="trn-ai-chip">Made with AI. Check it.</span>}
      </div>
      {ai.stronger ? (
        <>
          <p className="trn-fb__stronger">{quoted(ai.stronger)}</p>
          <p className="trn-note">Built only from what you said and your CV. Say it in your own words; don’t learn it by heart.</p>
        </>
      ) : (
        <p className="trn-note">
          None this time. The AI’s version said something that is in neither your answer nor your CV, so we didn’t show it.
        </p>
      )}
    </section>
  );
}

/** Where the model's part of the feedback is: asked for, here, or not to be had right now. */
export type AiState = "loading" | "ready" | "unavailable";

export interface TrainerFeedbackProps {
  session: Meta & Pick<LiveSession, "englishNotes">;
  n: number;
  total: number;
  question: { text: string; requirement: string | null };
  turn: LiveTurn;
  /** with the model: where its feedback on this answer is */
  aiState?: AiState;
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
  onDismissNote?: (index: number) => void;
  /** asks the model for its feedback again, after "unavailable" */
  onAskAgain?: () => void;
}

export function TrainerFeedback(p: TrainerFeedbackProps) {
  const t = p.turn;
  const ai = t.ai;
  const fillers = t.fillers.reduce((a, f) => a + f.count, 0);
  const tools = t.unused.filter((f) => !/\d/.test(f));
  const star = (["situation", "task", "action", "result"] as const).flatMap((k) => ai?.criteria.filter((c) => c.key === k) ?? []);
  const measured = measuredForShow(t.criteria);
  const marked = ai ? marksOf(ai) : [];
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
            <div className="trn-panel__head">
              <h2 id="trn-fb-answer" className="trn-h2">Your answer</h2>
              {marked.some((m) => m.mark === "vague") && <span className="trn-key"><span aria-hidden="true" className="trn-key__mark trn-key__mark--vague" />vague</span>}
              {marked.some((m) => m.mark === "english") && <span className="trn-key"><span aria-hidden="true" className="trn-key__mark trn-key__mark--english" />English note</span>}
            </div>
            <p className="trn-fb__answer"><MarkedAnswer text={t.answer ?? ""} ai={ai} /></p>
            {t.follow.map((f, i) => (
              <div key={i} className="trn-fb__follow">
                <p className="trn-fb__follow-q"><span className="trn-fb__follow-who">Follow-up</span> {quoted(f.question)}</p>
                {f.answer != null
                  ? <p className="trn-fb__answer"><MarkedAnswer text={f.answer} ai={ai} /></p>
                  : <p className="trn-note">You skipped it.</p>}
              </div>
            ))}
          </section>

          <section className="trn-panel" aria-labelledby="trn-fb-showed">
            <h2 id="trn-fb-showed" className="trn-h2">{p.session.ai ? LISTENS_FOR[p.session.kind] : "What this answer showed"}</h2>
            {p.aiState === "loading" && <p className="trn-fb__wait" role="status">The interviewer is reading your answer…</p>}
            {p.aiState === "unavailable" && (
              <p className="trn-warn" role="status">
                The AI feedback isn’t available right now. This is what your answer measured.
                {p.onAskAgain && <> <button type="button" className="trk-link trk-link--inline" disabled={p.busy} onClick={p.onAskAgain}>Try again</button></>}
              </p>
            )}
            {/* the four parts in a row of their own; what the answer measured under it, in wider boxes: its quotes are whole sentences */}
            {star.length > 0 && (
              <div className="trn-crit">
                {star.map((c) => <CriterionBox key={c.key} c={c} requirement={p.question.requirement} used={t.used} />)}
              </div>
            )}
            {measured.length > 0 && (
              <div className="trn-crit">
                {measured.map((c) => <CriterionBox key={c.key} c={c} requirement={p.question.requirement} used={t.used} />)}
              </div>
            )}
            {t.numbers ? (
              <div className="trn-callout">
                {/* a result said in words, the CV's numbers still unsaid: the box above is ticked, so this asks for the numbers only */}
                <p className="trn-callout__title">
                  {star.some((c) => c.key === "result" && c.met) ? "Say it in numbers. They’re already in your CV:" : "Say the result. It’s already in your CV:"}
                </p>
                <p className="trn-callout__line">“<Highlighted line={t.cvLine} part={t.numbers} />”</p>
              </div>
            ) : tools.length > 0 && !t.used.length ? (
              <div className="trn-callout">
                <p className="trn-callout__title">Name what you used. It’s already in your CV:</p>
                <p className="trn-callout__line">“<Highlighted line={t.cvLine} part={tools[0]} />”</p>
              </div>
            ) : null}
          </section>

          {ai && ai.vague.length > 0 && (
            <section className="trn-panel" aria-labelledby="trn-fb-concrete">
              <h2 id="trn-fb-concrete" className="trn-h2">Make it concrete</h2>
              <ul className="trn-vague">
                {ai.vague.map((v) => (
                  <li key={v.phrase}><mark className="trn-mark trn-mark--vague">{quoted(v.phrase)}</mark> <span>{v.ask}</span></li>
                ))}
              </ul>
            </section>
          )}

          {ai && <StrongerAnswer ai={ai} />}
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

          {ai && p.session.englishNotes && (
            <section className="trn-panel" aria-labelledby="trn-fb-english">
              <h2 id="trn-fb-english" className="trn-h2">
                English{ai.english.length > 0 && ` · ${ai.english.length} ${ai.english.length === 1 ? "note" : "notes"}`}
              </h2>
              <EnglishNotes ai={ai} busy={p.busy} onDismiss={(i) => p.onDismissNote?.(i)} />
            </section>
          )}

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
