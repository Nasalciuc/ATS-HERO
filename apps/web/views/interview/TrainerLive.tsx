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
import { AlertLine, ArrowUp } from "@/components/figma-icons";
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

/**
 * Where the interview is, as the builder and the score flow show their steps: a circle a question,
 * the one being asked in the ring, and the report at the end. Wide screens only: on a phone the
 * line over the question says "Question 2 of 4".
 */
export function QuestionSteps({ n, total, done = false }: { n: number; total: number; done?: boolean }) {
  const state = (i: number) => (done || i < n ? " is-done" : i === n ? " is-current" : "");
  return (
    <ol className="trn-steps" aria-label="Questions">
      {Array.from({ length: total }, (_, k) => k + 1).map((i) => (
        <li key={i} className="trn-steps__item" aria-current={!done && i === n ? "step" : undefined}>
          {i > 1 && <span className={`trn-steps__line${done || i <= n ? " is-filled" : ""}`} aria-hidden="true" />}
          <span className="trn-steps__step">
            <span className={`trn-steps__node${state(i)}`}>{i}</span>
            <span className={`trn-steps__label${state(i)}`}>Question {i}</span>
          </span>
        </li>
      ))}
      <li className="trn-steps__item" aria-current={done ? "step" : undefined}>
        <span className={`trn-steps__line${done ? " is-filled" : ""}`} aria-hidden="true" />
        <span className="trn-steps__step">
          <span className={`trn-steps__node trn-steps__node--emoji${done ? " is-current" : ""}`}><span aria-hidden="true">📋</span></span>
          <span className={`trn-steps__label${done ? " is-current" : ""}`}>Report</span>
        </span>
      </li>
    </ol>
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
      <QuestionSteps n={p.n} total={p.total} done={p.phase === "finished"} />
      <div className="trn-live__body">
        <main className="trn-live__main">
          {/* while the interviewer reads, the circle under it says so to the eye; this line says it to a screen reader */}
          <p className={`trn-live__status trn-live__status--${p.phase}${p.phase === "thinking" ? " trk-sr" : ""}`} role="status" aria-live="polite">{status}</p>

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
            <div className="trn-card trn-live__card">
              <label className="trn-live__answer">
                <span className="trn-label">Your answer</span>
                <textarea
                  rows={7}
                  maxLength={6000}
                  value={p.draft}
                  onChange={(e) => p.onDraft(e.target.value)}
                  placeholder={p.session.timer ? "Type your answer. A reminder comes at two minutes." : "Type your answer. Take your time; there is no timer."}
                />
              </label>
              {p.session.timer && (
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
            </div>
          )}

          {/* the score page's loading circle: the lilac disc, the green ring turning, and what is going on under it */}
          {p.phase === "thinking" && (
            <div className="trn-reading">
              <div className="trn-reading__badge" aria-hidden="true">
                <svg className="trn-reading__ring" viewBox="0 0 236 236" focusable="false">
                  <circle cx="118" cy="118" r="117" pathLength={360} strokeDasharray="334 26" transform="rotate(27 118 118)" />
                </svg>
                <span className="trn-reading__emoji">🤔</span>
              </div>
              <p className="trn-reading__msg" aria-hidden="true">Thinking…</p>
              <p className="trn-reading__note">Your answer is saved. The clock is stopped while the interviewer reads it.</p>
            </div>
          )}
          {p.phase === "paused" && <p className="trn-live__note">Your answers so far are saved. Resume when you’re ready{p.retrying ? "" : ", or skip this question"}.</p>}
          {p.phase === "finished" && <p className="trn-live__note">Your answers are saved. See what they showed in your report.</p>}
          {p.error && <p className="trk-error" role="alert">{p.error}</p>}

          <div className="trn-live__controls">
            {p.phase === "answering" && (
              <>
                <button type="button" className="topbtn topbtn--ghost" disabled={p.busy} onClick={p.onPause}>Pause</button>
                <button type="button" className="topbtn topbtn--dark" disabled={p.busy || !p.draft.trim()} onClick={p.onSend}>
                  {p.busy ? "Sending…" : timeUp && !p.retrying ? "Send and finish" : "Send answer"} <ArrowUp className="topbtn__arrow--right" />
                </button>
              </>
            )}
            {p.phase === "paused" && (
              <>
                {(!p.retrying || p.followUp) && <button type="button" className="topbtn topbtn--ghost" disabled={p.busy} onClick={p.onSkip}>Skip this question</button>}
                <button type="button" className="topbtn topbtn--dark" disabled={p.busy} onClick={p.onResume}>Resume</button>
              </>
            )}
            {p.phase === "finished" && (
              <button type="button" className="topbtn topbtn--dark" disabled={p.busy} onClick={p.onReport}>See your report <ArrowUp className="topbtn__arrow--right" /></button>
            )}
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
/** The picture each part goes by, in a ring: as the builder's steps and the score page's rows have theirs. */
const EMOJI: Record<InterviewCriterion["key"], string> = {
  situation: "📍",
  task: "🎯",
  action: "🛠️",
  result: "📈",
  requirement: "🧩",
  proof: "📋",
};
/** Whether a part is there, in a word. A fact about the answer, never a grade (IV-6). */
const STATE: Record<InterviewCriterion["key"], [there: string, not: string]> = {
  situation: ["Said", "Missing"],
  task: ["Said", "Missing"],
  action: ["Said", "Missing"],
  result: ["Said", "Missing"],
  requirement: ["Named", "Not named"],
  proof: ["Used", "Not used"],
};
/** What to say for a part that isn't there. Ours, the same for everyone: the model only finds the part or doesn't. */
const TO_SAY: Record<"situation" | "task" | "action" | "result", string> = {
  situation: "Say where this was, and what the problem was.",
  task: "Say what was yours to do.",
  action: "Say what you did yourself, step by step.",
  result: "Say what changed, in numbers if you have them.",
};
/** The four parts, as a sentence names them. */
const IN_WORDS: Record<"situation" | "task" | "action" | "result", string> = {
  situation: "the situation",
  task: "your task",
  action: "what you did",
  result: "the result",
};
export const LISTENS_FOR: Record<InterviewKind, string> = {
  recruiter: "What a recruiter listens for",
  technical: "What a technical interviewer listens for",
  manager: "What a hiring manager listens for",
};

/** Beside a part's state: the person's own words when it is there, what to say when it isn't. */
export function criterionNote(c: InterviewCriterion, requirement: string | null, used: string[] = []): string {
  if (c.met && c.quote) return quoted(c.quote);
  if (c.key === "requirement") return c.met ? "Named in your answer." : `Say where you used ${requirement ?? "it"}.`;
  // a fact said another way than the CV writes it ("twelve hours") has no sentence to show
  if (c.key === "proof") return c.met ? `You used: ${used.join(", ")}.` : "Add a number or a tool from your CV line.";
  return TO_SAY[c.key];
}

/**
 * What the answer measured, for showing: when the proof stands in the very sentence that names the
 * requirement, the sentence is shown once, and the proof says which of the CV's facts it used.
 */
export function measuredForShow(criteria: InterviewCriterion[]): InterviewCriterion[] {
  const named = criteria.find((c) => c.key === "requirement" && c.met)?.quote;
  return criteria.map((c) => (c.key === "proof" && c.met && c.quote && c.quote === named ? { ...c, quote: null } : c));
}

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The card's first sentence: what the rows under it say, in plain words. With the model's reading,
 * the parts of the answer; without it, what the answer measured. The same facts, never a verdict.
 */
export function summaryOf(parts: InterviewCriterion[], measured: InterviewCriterion[]): string {
  const star = parts.filter((c): c is InterviewCriterion & { key: keyof typeof IN_WORDS } => c.key in IN_WORDS);
  if (star.length) {
    const there = star.filter((c) => c.met).map((c) => IN_WORDS[c.key]);
    const missing = star.filter((c) => !c.met).map((c) => IN_WORDS[c.key]);
    if (!missing.length) return there.length === 4 ? `Your answer has all four parts: ${listWords(there)}.` : `Your answer has ${listWords(there)}.`;
    if (!there.length) return `Your answer doesn’t show these parts yet: ${listWords(missing)}.`;
    return `Your answer has ${listWords(there)}. ${sentence(listWords(missing))} ${missing.length === 1 ? "is" : "are"} missing.`;
  }
  const named = measured.find((c) => c.key === "requirement");
  const proof = measured.find((c) => c.key === "proof");
  if (proof?.met) return named?.met ? "You named what the job asks for, and used a fact from your CV." : named ? "You used a fact from your CV. Name what the job asks for too." : "You used a fact from your CV.";
  return named?.met ? "You named what the job asks for. Add a number or a tool from your CV." : "Your answer didn’t use your CV yet. Add a number or a tool from it.";
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

/** One part, as a row: its picture in a ring, its name, whether it is there, and the person's words or what to say. */
function PartRow({ c, requirement, used }: { c: InterviewCriterion; requirement: string | null; used: string[] }) {
  const [there, not] = STATE[c.key];
  return (
    <li className={`trn-row ${c.met ? "is-there" : "is-missing"}`}>
      <span className="trn-row__icon" aria-hidden="true">{EMOJI[c.key]}</span>
      <span className="trn-row__label">{CRITERION[c.key]}</span>
      <span className="trn-row__state">{c.met ? there : not}</span>
      <span className="trn-row__note">{criterionNote(c, requirement, used)}</span>
    </li>
  );
}

/** The English notes that still stand on one answer, numbered, each with "I said it right" (B2). */
export function EnglishNotes({ ai, busy, onDismiss }: { ai: NonNullable<LiveTurn["ai"]>; busy: boolean; onDismiss: (index: number) => void }) {
  return (
    <>
      {ai.english.length > 0 ? (
        <ol className="score-group__list trn-notes">
          {ai.english.map((n, i) => (
            <li key={n.index} className="trn-notes__item">
              <span className="score-group__num" aria-hidden="true">({i + 1})</span>
              <span className="trn-notes__body">
                <span className="trn-notes__fix"><del>{n.quote}</del> <span aria-hidden="true">→</span><span className="trk-sr"> better: </span> <strong>{n.better}</strong></span>
                {n.why && <span className="trn-notes__why">{n.why}</span>}
              </span>
              <button type="button" className="trn-chip-btn" disabled={busy} onClick={() => onDismiss(n.index)}>I said it right</button>
            </li>
          ))}
        </ol>
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
 * "A stronger answer", or why there is none to show, in the Pro Tips card's shape. Null when the
 * model gave none. `id` names its heading (a report has one per question); `sub`: under a question's
 * own heading, in a report.
 */
export function StrongerAnswer({ ai, id = "trn-fb-stronger", sub = false }: { ai: NonNullable<LiveTurn["ai"]>; id?: string; sub?: boolean }) {
  if (!ai.stronger && !ai.strongerRefused) return null;
  const Heading = sub ? "h3" : "h2";
  return (
    <section className={`trn-tips${sub ? " trn-tips--sub" : ""}`} aria-labelledby={id}>
      {ai.stronger && <span className="trn-tips__badge">Made with AI. Check it.</span>}
      <Heading id={id} className="trn-tips__title">A stronger answer</Heading>
      {ai.stronger ? (
        <>
          <p className="trn-tips__text">{quoted(ai.stronger)}</p>
          <p className="trn-tips__note">Built only from what you said and your CV. Say it in your own words; don’t learn it by heart.</p>
        </>
      ) : (
        <p className="trn-tips__note">
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

/**
 * The feedback after an answer, built from the score page's pieces (PROVISIONAL, AGENTS.md rule 6:
 * no Figma frame; Liubovi draws or checks it): one plain sentence beside a circle, the parts as rows
 * with a picture in a ring, badges over numbered lists, and the stronger answer as a tips card.
 */
export function TrainerFeedback(p: TrainerFeedbackProps) {
  const t = p.turn;
  const ai = t.ai;
  const tools = t.unused.filter((f) => !/\d/.test(f));
  const star = (["situation", "task", "action", "result"] as const).flatMap((k) => ai?.criteria.filter((c) => c.key === k) ?? []);
  const measured = measuredForShow(t.criteria);
  const marked = ai ? marksOf(ai) : [];
  const reading = p.aiState === "loading";
  const counts = [
    duration(t.seconds),
    `${t.words} ${t.words === 1 ? "word" : "words"}`,
    t.fillers.length > 0 ? `filler words: ${t.fillers.map((f) => `“${f.word}” ×${f.count}`).join(", ")}` : "",
  ].filter(Boolean);
  return (
    <div className="trn trn-live trn-fb">
      <LiveHeader session={p.session} status={`Question ${p.n} of ${p.total} · the clock is stopped`} timeLeft={p.timeLeft} busy={p.busy} onEnd={p.onEnd} />
      <QuestionSteps n={p.n} total={p.total} />
      <main className="trn-fb__page">
        <div className="trn-fb__title">
          <p className="trn-fb__kicker">Feedback · question {p.n} of {p.total}</p>
          <h1 className="trn-fb__q">{quoted(p.question.text)}</h1>
        </div>

        <div className="trn-fb__head">
          <span className={`trn-fb__circle${reading ? " is-reading" : ""}`} aria-hidden="true">
            {reading && (
              <svg className="trn-fb__ring" viewBox="0 0 159 159" focusable="false">
                <circle cx="79.5" cy="79.5" r="78.5" pathLength={360} strokeDasharray="334 26" />
              </svg>
            )}
            <span className="trn-fb__emoji">📝</span>
          </span>
          <div className="trn-fb__msg">
            <p className="trn-fb__lead">{summaryOf(star, measured)}</p>
            {reading && <p className="trn-fb__wait" role="status">The interviewer is reading your answer…</p>}
            {p.aiState === "unavailable" && (
              <p className="trn-warn" role="status">
                The AI feedback isn’t available right now. This is what your answer measured.
                {p.onAskAgain && <> <button type="button" className="trk-link trk-link--inline" disabled={p.busy} onClick={p.onAskAgain}>Try again</button></>}
              </p>
            )}
          </div>
        </div>

        <section className="trn-card" aria-labelledby="trn-fb-answer">
          <div className="trn-card__head">
            <h2 id="trn-fb-answer" className="trn-label">Your answer</h2>
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
          <p className="trn-fb__counts">{counts.join(" · ")}</p>
        </section>

        <section className="trn-fb__section" aria-labelledby="trn-fb-showed">
          <h2 id="trn-fb-showed" className="trn-fb__h">{p.session.ai ? LISTENS_FOR[p.session.kind] : "What this answer showed"}</h2>
          {/* the four parts first, then what the answer measured: the requirement and the proof from the CV */}
          <ul className="trn-rows">
            {star.map((c) => <PartRow key={c.key} c={c} requirement={p.question.requirement} used={t.used} />)}
            {measured.map((c) => <PartRow key={c.key} c={c} requirement={p.question.requirement} used={t.used} />)}
          </ul>
          {t.numbers ? (
            <div className="trn-callout">
              {/* a result said in words, the CV's numbers still unsaid: the row above says "Said", so this asks for the numbers only */}
              <p className="trn-callout__title">
                <span aria-hidden="true">💡 </span>
                {star.some((c) => c.key === "result" && c.met) ? "Say it in numbers. They’re already in your CV:" : "Say the result. It’s already in your CV:"}
              </p>
              <p className="trn-callout__line">“<Highlighted line={t.cvLine} part={t.numbers} />”</p>
            </div>
          ) : tools.length > 0 && !t.used.length ? (
            <div className="trn-callout">
              <p className="trn-callout__title"><span aria-hidden="true">💡 </span>Name what you used. It’s already in your CV:</p>
              <p className="trn-callout__line">“<Highlighted line={t.cvLine} part={tools[0]} />”</p>
            </div>
          ) : null}
        </section>

        {ai && ai.vague.length > 0 && (
          <section className="score-group score-group--wide" aria-labelledby="trn-fb-concrete">
            <h2 id="trn-fb-concrete" className="trn-badge-h"><span className="score-badge score-badge--suggestion"><AlertLine size={18} /> Make it concrete</span></h2>
            <ol className="score-group__list">
              {ai.vague.map((v, i) => (
                <li key={v.phrase}>
                  <span className="score-group__num" aria-hidden="true">({i + 1})</span>
                  <span><mark className="trn-mark trn-mark--vague">{quoted(v.phrase)}</mark> {v.ask}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {ai && p.session.englishNotes && (
          <section className="score-group score-group--wide" aria-labelledby="trn-fb-english">
            <h2 id="trn-fb-english" className="trn-badge-h">
              <span className="score-badge score-badge--read">English{ai.english.length > 0 && ` · ${ai.english.length} ${ai.english.length === 1 ? "note" : "notes"}`}</span>
            </h2>
            <EnglishNotes ai={ai} busy={p.busy} onDismiss={(i) => p.onDismissNote?.(i)} />
          </section>
        )}

        {ai && <StrongerAnswer ai={ai} />}

        <p className="trn-note trn-fb__named">
          {t.named.length > 0 ? `What the job asks that you named: ${listWords(t.named)}.` : "None of the post’s requirements, by name."}
          {p.ahead.length > 0 && ` Still to come in this session: ${listWords(p.ahead)}.`}
        </p>
      </main>
      <footer className="trn-fb__foot">
        {p.canRetry && <button type="button" className="topbtn topbtn--ghost" disabled={p.busy} onClick={p.onRetry}><span>Try <span className="trn-wide">this answer </span>again</span></button>}
        {p.canRetry && <span className="trn-note trn-fb__foot-note">Trying again doesn’t use time from the interview.</span>}
        <button type="button" className="topbtn topbtn--dark trn-fb__next" disabled={p.busy} onClick={p.onNext}>
          {p.last ? "See your report" : "Next question"} <ArrowUp className="topbtn__arrow--right" />
        </button>
        {p.error && <p className="trk-error" role="alert">{p.error}</p>}
      </footer>
    </div>
  );
}
