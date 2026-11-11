"use client";
/**
 * Interview Trainer: the practice report, built from the score page's pieces (PROVISIONAL, AGENTS.md
 * rule 6: no Figma frame; Liubovi draws or checks it). In B7's order: what went well, the things to
 * practise with "Practice these again", the required items with no proof yet, the job's progress
 * from its second session, then the questions one by one.
 *
 * As her results page: a circle beside one plain sentence and the way on, badges over numbered
 * lists, and the questions as rows that open (a number in a ring, the state in a word, the lilac
 * toggle). The circle counts the questions answered; nothing on the page is a score (IV-6).
 *
 * Counted from the answers, the CV and the post. When the interviewer was the model
 * (ANTRENOR-INTERVIU-CONSTRUCTIE.md, step 5), each question also has its follow-ups and the model's
 * feedback as on the card after an answer, and the session has the kinds of English note that came
 * up more than once. The note at the bottom says which of the two the report is (rule 10). Print is
 * the browser's (B7: no PDF of ours; rule 7 is the CV's).
 */
import type { ReportView } from "@/app/actions/interview";
import { AlertLine, ArrowUp, MinusThin, PlusThin } from "@/components/figma-icons";
import { KIND_LABEL, STYLE_LABEL, type QuestionReport, type ReqState, type SessionSummary } from "@/lib/interview/report";
import type { InterviewPrepared } from "@/lib/types";
import { BackLink, TrainerSteps } from "./TrainerBlocked";
import { ConcreteGroup, EnglishGroup, MarkedAnswer, measuredForShow, PartRow, quoted, StrongerAnswer } from "./TrainerLive";
import { dayLabel, duration, longDate, whenLabel } from "./format";

type Tone = "good" | "fair" | "none";
const STATE: Record<ReqState, { label: string; tone: Tone }> = {
  proof: { label: "Proof given", tone: "good" },
  asked: { label: "Asked, no proof", tone: "fair" },
  not_asked: { label: "Not asked", tone: "none" },
};
const PREPARED: { value: InterviewPrepared; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "a_bit", label: "A bit" },
  { value: "no", label: "No" },
];
const PARTS = ["situation", "task", "action", "result"] as const;

function tagOf(q: QuestionReport): { label: string; tone: Tone } {
  if (q.state === "not_reached") return { label: "Not asked", tone: "none" };
  if (q.state === "skipped") return { label: "Skipped", tone: "fair" };
  // with the model's feedback, the answer's result; without, whether it used a fact of the CV line
  const result = q.ai?.criteria.find((c) => c.key === "result");
  if (result) return result.met ? { label: "Result given", tone: "good" } : { label: "Result missing", tone: "fair" };
  return q.used.length ? { label: "Fact from your CV", tone: "good" } : { label: "No fact from your CV", tone: "fair" };
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * The report's first sentence: the first thing that went well and the first thing to practise, as
 * the lists under it have them. The same counts, in one breath; never a verdict.
 */
export function reportLead(s: Pick<SessionSummary, "answered" | "wentWell" | "toPractice">): string {
  if (!s.answered) return "No answer was sent in this session.";
  const well = s.wentWell[0];
  const next = s.toPractice[0]?.text;
  if (well && next) return `${well} Next: ${lower(next)}`;
  if (well) return well;
  if (next) return `Next time: ${lower(next)}`;
  return "Your answers are counted below.";
}

/** Where the model's feedback on a question is, when it isn't in the report yet. */
export type ReportWait = "loading" | "unavailable";

interface QuestionBlockProps {
  q: QuestionReport;
  open: boolean;
  /** the session's interviewer was the model, and the person left English notes on */
  ai: boolean;
  englishNotes: boolean;
  wait?: ReportWait;
  busy: boolean;
  onDismissNote: (turnId: string, index: number) => void;
}

/** One question, as a row that opens: its number in a ring, the question, its state in a word, the toggle. */
function QuestionBlock({ q, open, ai, englishNotes, wait, busy, onDismissNote }: QuestionBlockProps) {
  const tag = tagOf(q);
  const measured = measuredForShow(q.criteria);
  const parts = PARTS.flatMap((k) => q.ai?.criteria.filter((c) => c.key === k) ?? []);
  /** an answer the model read and had no English note on: one line says so, without the notes' own block */
  const noNotes = !!q.ai && englishNotes && q.ai.english.length === 0 && q.ai.dismissed === 0;
  const counts = q.measures
    ? [duration(q.measures.seconds), `${q.measures.words} ${q.measures.words === 1 ? "word" : "words"}`, q.tries > 1 ? `answered ${q.tries} times; this is the last answer` : ""].filter(Boolean)
    : [];
  return (
    <details className="trn-q" open={open}>
      <summary className="trn-q__summary">
        <span className={`trn-q__num is-${tag.tone}`} aria-hidden="true">{q.n}</span>
        <strong className="trn-q__text"><span className="trk-sr">{q.n}. </span>{quoted(q.text)}</strong>
        <span className={`trn-state is-${tag.tone}`}>{tag.label}</span>
        <span className="trn-q__toggle" aria-hidden="true"><PlusThin size={34} className="trn-q__plus" /><MinusThin className="trn-q__minus" /></span>
      </summary>
      <div className="trn-q__body">
        {q.state === "answered" && (
          <>
            <div className="trn-fcard trn-q__card">
              <span className="trn-label">Your answer</span>
              <p className="trn-fb__answer"><MarkedAnswer text={q.answer ?? ""} ai={q.ai} /></p>
              {q.follow.map((f, i) => (
                <div key={i} className="trn-fb__follow">
                  <p className="trn-fb__follow-q"><span className="trn-fb__follow-who">Follow-up</span> {quoted(f.question)}</p>
                  {f.answer != null
                    ? <p className="trn-fb__answer"><MarkedAnswer text={f.answer} ai={q.ai} /></p>
                    : <p className="trn-note">You skipped it.</p>}
                </div>
              ))}
              {counts.length > 0 && <p className="trn-fb__counts">{counts.join(" · ")}</p>}
            </div>
            {parts.length + measured.length > 0 && (
              <ul className="trn-rows trn-rows--compact">
                {parts.map((c) => <PartRow key={c.key} c={c} requirement={q.requirement} used={q.used} />)}
                {measured.map((c) => (
                  <PartRow key={c.key} c={c} requirement={q.requirement} used={q.used} label={c.key === "requirement" ? q.requirement ?? undefined : undefined} />
                ))}
              </ul>
            )}
            {q.unused.length > 0 && <p className="trn-note">Still in your CV, not said: {q.unused.join(", ")}.</p>}
            {q.ai && <ConcreteGroup ai={q.ai} id={`trn-concrete-${q.id}`} sub />}
            {q.ai && englishNotes && !noNotes && (
              <EnglishGroup ai={q.ai} id={`trn-english-${q.id}`} sub busy={busy} onDismiss={(index) => q.turnId && onDismissNote(q.turnId, index)} />
            )}
            {noNotes && <p className="trn-note">English: no notes on this answer.</p>}
            {q.ai && <StrongerAnswer ai={q.ai} id={`trn-stronger-${q.id}`} sub />}
            {ai && !q.ai && wait === "loading" && <p className="trn-fb__wait" role="status">The interviewer is reading this answer…</p>}
            {ai && !q.ai && wait === "unavailable" && <p className="trn-note">The AI feedback on this answer isn’t available right now. The counts above are from your answer.</p>}
          </>
        )}
        {q.state === "skipped" && <p className="trn-note">You skipped this question.</p>}
        {q.state === "not_reached" && <p className="trn-note">The interview ended before this question.</p>}
        <p className="trn-note">Your CV says: {quoted(q.bullet.text)}</p>
      </div>
    </details>
  );
}

export interface TrainerReportProps {
  report: ReportView;
  now: number;
  busy: "again" | "delete" | "prepared" | "note" | null;
  confirmDelete: boolean;
  message: string | null;
  /** with the model: the answers whose feedback isn't here yet (by their turn), asked for or not to be had */
  waiting?: Record<string, ReportWait>;
  onPracticeThese: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
  onPrepared: (value: InterviewPrepared) => void;
  /** opens the session's CV in the builder */
  onOpenCv: () => void;
  onDismissNote?: (turnId: string, index: number) => void;
  /** asks for the model's feedback again, after it couldn't be had */
  onAskAgain?: () => void;
}

export default function TrainerReport(p: TrainerReportProps) {
  const r = p.report;
  const s = r.summary;
  const done = r.status === "done";
  const meta = [
    whenLabel(r.at, p.now), KIND_LABEL[r.kind], r.ai ? STYLE_LABEL[r.style] : "", `${r.minutes} min`, `${s.total} questions`, r.mode === "typing" ? "typed" : "",
  ].filter(Boolean);
  const practise = s.toPractice.length;
  const waits = Object.values(p.waiting ?? {});
  const read = s.questions.filter((q) => q.ai).length;
  return (
    <div className="trn trn-report">
      <BackLink />
      <TrainerSteps current={2} />
      <p className="trn-report__meta"><strong>{r.role} · {r.company}</strong> · {meta.join(" · ")}</p>

      {!done && (
        <p className="trn-warn" role="status">
          This interview isn’t finished. <a className="trk-a" href={`/app/interview/${encodeURIComponent(r.id)}`}>Continue it</a>; the report counts what you’ve said so far.
        </p>
      )}
      {waits.includes("loading") && (
        <p className="trn-fb__wait" role="status">
          The interviewer is reading your answers: {read} of {s.answered} done. The report fills in as it goes.
        </p>
      )}
      {!waits.includes("loading") && waits.includes("unavailable") && (
        <p className="trn-warn" role="status">
          The AI feedback isn’t available right now for {waits.length === 1 ? "one answer" : `${waits.length} answers`}. The rest of the report is counted from your answers.
          {p.onAskAgain && <> <button type="button" className="trk-link trk-link--inline" onClick={p.onAskAgain}>Try again</button></>}
        </p>
      )}
      {p.message && <p className="trk-error" role="alert">{p.message}</p>}

      {/* the results page's head: a circle (here, the questions answered: a count, not a score), one sentence, the way on */}
      <div className="trn-fb__head trn-report__head">
        <p className="trn-count">
          <span className="trn-count__value">{s.answered}<span className="trn-count__of"> / {s.total}</span></span>
          <span className="trn-count__label">answered</span>
        </p>
        <div className="trn-fb__msg">
          <p className="trn-fb__lead">{reportLead(s)}</p>
          {done && practise > 0 && s.focus.length > 0 && (
            <div className="trn-report__again">
              <button type="button" className="topbtn topbtn--dark" disabled={p.busy !== null} onClick={p.onPracticeThese}>
                {p.busy === "again" ? "Starting…" : "Practice these again"} <ArrowUp className="topbtn__arrow--right" />
              </button>
              <span className="trn-note">A 10-minute session that asks these first, in other words.</span>
            </div>
          )}
        </div>
      </div>

      <div className="trn-report__groups">
        <section className="score-group score-group--wide" aria-labelledby="trn-well">
          <h2 id="trn-well" className="trn-badge-h"><span className="score-badge score-badge--good"><AlertLine size={18} /> What went well</span></h2>
          {s.wentWell.length ? (
            <ol className="score-group__list">
              {s.wentWell.map((w, i) => <li key={w}><span className="score-group__num" aria-hidden="true">({i + 1})</span><span>{w}</span></li>)}
            </ol>
          ) : (
            <p className="trn-report__none">{s.answered ? "Nothing stood out in the counts yet. Name what the job asks for, and use a fact from your CV." : "No answer was sent in this session."}</p>
          )}
        </section>

        <section className="score-group score-group--wide" aria-labelledby="trn-practise">
          <h2 id="trn-practise" className="trn-badge-h">
            <span className="score-badge score-badge--suggestion">
              <AlertLine size={18} /> {practise === 1 ? "1 thing to practice" : practise ? `${practise} things to practice` : "Things to practice"}
            </span>
          </h2>
          {practise ? (
            <ol className="score-group__list">
              {s.toPractice.map((t, i) => (
                <li key={t.text + t.detail}>
                  <span className="score-group__num" aria-hidden="true">({i + 1})</span>
                  <span>{t.text} <span className="trn-muted">{t.detail}</span></span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="trn-report__none">Nothing to practise stood out in the counts. Practice again to cover more of what the job asks.</p>
          )}
        </section>

        <section className="score-group score-group--wide" aria-labelledby="trn-noproof">
          <h2 id="trn-noproof" className="trn-badge-h"><span className="score-badge score-level score-level--missing">No proof yet</span></h2>
          {s.noProof.length ? (
            <ol className="score-group__list">
              {s.noProof.map((n, i) => (
                <li key={n.label}>
                  <span className="score-group__num" aria-hidden="true">({i + 1})</span>
                  <span>
                    <strong>{n.label}</strong>{" "}
                    <span className="trn-muted">
                      {!n.inCv ? (
                        <>Not in your CV.{n.askedIn ? ` Question ${n.askedIn} asked about it.` : ""} If you’ve used it, <button type="button" className="trk-link trk-link--inline" onClick={p.onOpenCv}>add it to your CV</button> first.</>
                      ) : n.askedIn ? (
                        n.named ? `Question ${n.askedIn} asked; you named it without a fact from your CV.` : `Question ${n.askedIn} asked; your answer didn’t name it.`
                      ) : n.named ? "You named it without a fact from your CV." : "Not asked in this session."}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="trn-report__none">{r.required ? "Every required item had proof in this session." : "Add the post’s text in the Tracker to see its requirements here."}</p>
          )}
        </section>
      </div>

      <section className="trn-section" aria-labelledby="trn-progress">
        <h2 id="trn-progress" className="trn-fb__h">Progress for this job</h2>
        {r.progress ? (
          <div className="trn-progress">
            <table>
              <thead>
                <tr>
                  <th scope="col">What the job asks</th>
                  {r.progress.columns.map((c) => <th key={c.id} scope="col">{dayLabel(c.at, p.now)} · {KIND_LABEL[c.kind]}</th>)}
                </tr>
              </thead>
              <tbody>
                {r.progress.rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}{!row.required && <span className="trn-muted"> · nice to have</span>}</th>
                    {row.states.map((st, i) => (
                      <td key={i} data-label={`${dayLabel(r.progress!.columns[i].at, p.now)} · ${KIND_LABEL[r.progress!.columns[i].kind]}`}>
                        <span className={`trn-state is-${STATE[st].tone}`}>{STATE[st].label}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="trn-note trn-progress__note">Proof given: an answer named it and used a fact from your CV.</p>
          </div>
        ) : (
          <p className="trn-first">
            {r.sessionsForJob > 1 || !r.required
              ? "Add the post’s text in the Tracker to follow its requirements from one session to the next."
              : "This is your first session for this job. Practice again and you’ll see here which requirements you’ve given proof for each time."}
          </p>
        )}
      </section>

      {r.englishNotes && s.english && (
        <section className="score-group score-group--wide" aria-labelledby="trn-english">
          <h2 id="trn-english" className="trn-badge-h"><span className="score-badge score-badge--read">English · what came up more than once</span></h2>
          {s.english.patterns.length > 0 ? (
            <ol className="score-group__list">
              {s.english.patterns.map((x, i) => (
                <li key={x.kind}>
                  <span className="score-group__num" aria-hidden="true">({i + 1})</span>
                  <span><strong>{x.label}</strong> · {x.count} times · <span className="trn-muted">{quoted(x.example.quote)} → {quoted(x.example.better)}</span></span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="trn-report__none">{s.english.notes ? "No kind of note came up twice in this session." : "No notes in this session."}</p>
          )}
          {s.english.dismissed > 0 && (
            <p className="trn-note">
              You marked {s.english.dismissed} {s.english.dismissed === 1 ? "note" : "notes"} as “I said it right”; {s.english.dismissed === 1 ? "it isn’t" : "they aren’t"} counted.
            </p>
          )}
        </section>
      )}

      <section className="trn-section" aria-labelledby="trn-questions">
        <h2 id="trn-questions" className="trn-fb__h">The questions</h2>
        <div className="trn-qs">
          {s.questions.map((q, i) => (
            <QuestionBlock key={q.id} q={q} open={i === 0} ai={r.ai} englishNotes={r.englishNotes}
              wait={q.turnId ? p.waiting?.[q.turnId] : undefined} busy={p.busy !== null}
              onDismissNote={(turnId, index) => p.onDismissNote?.(turnId, index)} />
          ))}
        </div>
        {s.measured && (
          <p className="trn-note trn-measured">
            <span className="trn-label">Measured</span>{" "}
            <span><strong>{duration(s.measured.averageSeconds)}</strong> average answer</span>
            <span> · <strong>{s.measured.averageWords}</strong> words on average</span>
            {s.measured.wordsPerMinute != null && <span> · <strong>{s.measured.wordsPerMinute}</strong> words per minute</span>}
            <span> · <strong>{s.measured.fillers}</strong> filler words in all</span>
            <span>. Counts from your answers, not grades.</span>
          </p>
        )}
      </section>

      <div className="trn-pair">
        {done && (
          <section className="trn-box trn-box--grey" aria-labelledby="trn-prepared">
            <h2 id="trn-prepared" className="trn-h2">Do you feel more prepared for this interview?</h2>
            <div className="trn-prepared" role="radiogroup" aria-labelledby="trn-prepared">
              {PREPARED.map((o) => (
                <button key={o.value} type="button" role="radio" aria-checked={r.prepared === o.value}
                  className={`trn-btn trn-btn--ghost${r.prepared === o.value ? " is-on" : ""}`} disabled={p.busy !== null}
                  onClick={() => p.onPrepared(o.value)}>{o.label}</button>
              ))}
            </div>
            <span className="trn-note">Optional. It helps us see whether the trainer works.</span>
          </section>
        )}
        <section className="trn-box trn-box--plain" aria-labelledby="trn-data">
          <h2 id="trn-data" className="trn-h2">This session’s data</h2>
          <p>We keep your answers and this report until <strong>{longDate(r.keptUntil)}</strong> (180 days).</p>
          {p.confirmDelete && <p className="trn-confirm" role="alert">Delete your answers and this report? The Tracker job stays.</p>}
          <div className="trn-box__buttons">
            {p.confirmDelete ? (
              <>
                <button type="button" className="trn-btn trn-btn--danger" disabled={p.busy !== null} onClick={p.onDelete}>{p.busy === "delete" ? "Deleting…" : "Delete"}</button>
                <button type="button" className="trn-btn trn-btn--ghost" onClick={p.onCancelDelete}>Keep it</button>
              </>
            ) : (
              <button type="button" className="trn-btn trn-btn--ghost trn-btn--danger-ghost" onClick={p.onAskDelete}>Delete this session</button>
            )}
          </div>
        </section>
      </div>

      <p className="trn-foot">
        {r.ai
          ? "The interviewer was an AI. Its feedback and the stronger answers are made with AI from your answers and your CV: check them before you use them. The counts are from your answers, your CV and the job post."
          : "This report is counted from your answers, your CV and the job post, without AI."}
      </p>
    </div>
  );
}
