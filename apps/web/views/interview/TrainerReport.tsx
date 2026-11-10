"use client";
/**
 * Interview Trainer: the practice report (canvas "ATS Hero Tracker v2", page "Interview trainer",
 * Desktop · Practice report; on a phone, cards). In B7's order: what went well, the things to
 * practise with "Practice these again", the required items with no proof yet, the job's progress
 * from its second session, then the questions one by one.
 *
 * Counted from the answers, the CV and the post. When the interviewer was the model
 * (ANTRENOR-INTERVIU-CONSTRUCTIE.md, step 5), each question also has its follow-ups and the model's
 * feedback as on the card after an answer: the parts of the answer with the person's words, vague
 * phrases, English notes with "I said it right", a stronger answer; and the session has the kinds of
 * English note that came up more than once. The note at the bottom says which of the two the report
 * is (rule 10). Print is the browser's (B7: no PDF of ours; rule 7 is the CV's).
 */
import type { ReportView } from "@/app/actions/interview";
import { KIND_LABEL, STYLE_LABEL, type QuestionReport, type ReqState } from "@/lib/interview/report";
import type { InterviewCriterion, InterviewPrepared } from "@/lib/types";
import { BackLink } from "./TrainerBlocked";
import { EnglishNotes, MarkedAnswer, measuredForShow, quoted, StrongerAnswer } from "./TrainerLive";
import { dayLabel, duration, longDate, whenLabel } from "./format";

const STATE: Record<ReqState, { label: string; tone: string }> = {
  proof: { label: "Proof given", tone: "trk-chip--met" },
  asked: { label: "Asked, no proof", tone: "trk-chip--partial" },
  not_asked: { label: "Not asked", tone: "" },
};
const PREPARED: { value: InterviewPrepared; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "a_bit", label: "A bit" },
  { value: "no", label: "No" },
];
const PART: Record<"situation" | "task" | "action" | "result", string> = { situation: "Situation", task: "Task", action: "Action", result: "Result" };
const PARTS = ["situation", "task", "action", "result"] as const;

function tagOf(q: QuestionReport): { label: string; tone: string } {
  if (q.state === "not_reached") return { label: "Not asked", tone: "" };
  if (q.state === "skipped") return { label: "Skipped", tone: "trk-chip--partial" };
  // with the model's feedback, the answer's result; without, whether it used a fact of the CV line
  const result = q.ai?.criteria.find((c) => c.key === "result");
  if (result) return result.met ? { label: "Result given", tone: "trk-chip--met" } : { label: "Result missing", tone: "trk-chip--partial" };
  return q.used.length ? { label: "Fact from your CV", tone: "trk-chip--met" } : { label: "No fact from your CV", tone: "trk-chip--partial" };
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

function QuestionBlock({ q, open, ai, englishNotes, wait, busy, onDismissNote }: QuestionBlockProps) {
  const tag = tagOf(q);
  const measured = measuredForShow(q.criteria);
  const req = measured.find((c) => c.key === "requirement");
  const proof = measured.find((c) => c.key === "proof");
  /** an answer the model read and had no English note on: one line says so, without the notes' own block */
  const noNotes = !!q.ai && englishNotes && q.ai.english.length === 0 && q.ai.dismissed === 0;
  const parts = PARTS.flatMap((k) => q.ai?.criteria.filter((c) => c.key === k) ?? []) as (InterviewCriterion & { key: (typeof PARTS)[number] })[];
  return (
    <details className="trn-q" open={open}>
      <summary className="trn-q__summary">
        <strong className="trn-q__text">{q.n}. {quoted(q.text)}</strong>
        <span className={`trk-chip ${tag.tone}`}>{tag.label}</span>
      </summary>
      <div className="trn-q__body">
        {q.state === "answered" && (
          <>
            <p className="trn-q__answer">“<MarkedAnswer text={q.answer ?? ""} ai={q.ai} />”</p>
            {q.follow.map((f, i) => (
              <div key={i} className="trn-q__follow">
                <p className="trn-q__follow-q"><span className="trn-fb__follow-who">Follow-up</span> {quoted(f.question)}</p>
                {f.answer != null
                  ? <p className="trn-q__answer">“<MarkedAnswer text={f.answer} ai={q.ai} />”</p>
                  : <p className="trn-note">You skipped it.</p>}
              </div>
            ))}
            <ul className="trn-q__facts">
              {parts.map((c) => (
                <li key={c.key}><strong>{PART[c.key]}:</strong> {c.met && c.quote ? quoted(c.quote) : "missing"}</li>
              ))}
              {req && (
                <li><strong>{q.requirement}:</strong> {req.met ? <>named{req.quote && <> · {quoted(req.quote)}</>}</> : "not named in the answer"}</li>
              )}
              {proof && (
                <li><strong>Proof from your CV:</strong> {proof.met ? <>{q.used.join(", ")}{proof.quote && <> · {quoted(proof.quote)}</>}</> : "no number or tool from the CV line"}</li>
              )}
              {q.unused.length > 0 && <li><strong>Still in your CV, not said:</strong> {q.unused.join(", ")}</li>}
              {noNotes && <li><strong>English:</strong> no notes on this answer</li>}
              {q.measures && <li className="trn-muted">{duration(q.measures.seconds)} · {q.measures.words} words{q.tries > 1 ? ` · answered ${q.tries} times; this is the last answer` : ""}</li>}
            </ul>
            {q.ai && q.ai.vague.length > 0 && (
              <div className="trn-q__more">
                <h3 className="trn-h3">Make it concrete</h3>
                <ul className="trn-vague">
                  {q.ai.vague.map((v) => (
                    <li key={v.phrase}><mark className="trn-mark trn-mark--vague">{quoted(v.phrase)}</mark> <span>{v.ask}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {q.ai && englishNotes && !noNotes && (
              <div className="trn-q__more">
                <h3 className="trn-h3">English{q.ai.english.length > 0 && ` · ${q.ai.english.length} ${q.ai.english.length === 1 ? "note" : "notes"}`}</h3>
                <EnglishNotes ai={q.ai} busy={busy} onDismiss={(index) => q.turnId && onDismissNote(q.turnId, index)} />
              </div>
            )}
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

      <div className="trn-top3">
        <section className="trn-box trn-box--good" aria-labelledby="trn-well">
          <h2 id="trn-well" className="trn-h2">What went well</h2>
          {s.wentWell.length
            ? <ul className="trn-box__list">{s.wentWell.map((w) => <li key={w}>{w}</li>)}</ul>
            : <p>{s.answered ? "Nothing stood out in the counts yet. Name what the job asks for, and use a fact from your CV." : "No answer was sent in this session."}</p>}
        </section>

        <section className="trn-box trn-box--practise" aria-labelledby="trn-practise">
          <h2 id="trn-practise" className="trn-h2">{practise === 1 ? "1 thing to practice" : practise ? `${practise} things to practice` : "Things to practice"}</h2>
          {practise ? (
            <>
              <ol className="trn-box__list">
                {s.toPractice.map((t) => <li key={t.text + t.detail}>{t.text} <span className="trn-muted">{t.detail}</span></li>)}
              </ol>
              {done && s.focus.length > 0 && (
                <div className="trn-box__action">
                  <button type="button" className="trn-btn" disabled={p.busy !== null} onClick={p.onPracticeThese}>
                    {p.busy === "again" ? "Starting…" : "Practice these again"}
                  </button>
                  <span className="trn-note">A 10-minute session that asks these first, in other words.</span>
                </div>
              )}
            </>
          ) : (
            <p>Nothing to practise stood out in the counts. Practice again to cover more of what the job asks.</p>
          )}
        </section>

        <section className="trn-box trn-box--plain" aria-labelledby="trn-noproof">
          <h2 id="trn-noproof" className="trn-h2">No proof yet</h2>
          {s.noProof.length ? (
            <ul className="trn-noproof">
              {s.noProof.map((n) => (
                <li key={n.label}>
                  <strong className="trn-noproof__label">{n.label}</strong>
                  <span className="trn-noproof__why">
                    {!n.inCv ? (
                      <>Not in your CV.{n.askedIn ? ` Question ${n.askedIn} asked about it.` : ""} If you’ve used it, <button type="button" className="trk-link trk-link--inline" onClick={p.onOpenCv}>add it to your CV</button> first.</>
                    ) : n.askedIn ? (
                      n.named ? `Question ${n.askedIn} asked; you named it without a fact from your CV.` : `Question ${n.askedIn} asked; your answer didn’t name it.`
                    ) : n.named ? "You named it without a fact from your CV." : "Not asked in this session."}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>{r.required ? "Every required item had proof in this session." : "Add the post’s text in the Tracker to see its requirements here."}</p>
          )}
        </section>
      </div>

      <section className="trn-section" aria-labelledby="trn-progress">
        <h2 id="trn-progress" className="trk-label">Progress for this job</h2>
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
                        <span className={`trk-chip ${STATE[st].tone}`}>{STATE[st].label}</span>
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

      {(s.measured || (r.englishNotes && s.english)) && (
        <div className="trn-duo">
          {r.englishNotes && s.english && (
            <section className="trn-box trn-box--plain" aria-labelledby="trn-english">
              <h2 id="trn-english" className="trn-h2">English · what came up more than once</h2>
              {s.english.patterns.length > 0 ? (
                <ul className="trn-patterns">
                  {s.english.patterns.map((x) => (
                    <li key={x.kind}>
                      <strong>{x.label}</strong> · {x.count} times · <span className="trn-muted">{quoted(x.example.quote)} → {quoted(x.example.better)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{s.english.notes ? "No kind of note came up twice in this session." : "No notes in this session."}</p>
              )}
              {s.english.dismissed > 0 && (
                <p className="trn-note">
                  You marked {s.english.dismissed} {s.english.dismissed === 1 ? "note" : "notes"} as “I said it right”; {s.english.dismissed === 1 ? "it isn’t" : "they aren’t"} counted.
                </p>
              )}
            </section>
          )}
          {s.measured && (
            <section className="trn-box trn-box--plain trn-measured" aria-labelledby="trn-measured">
              <h2 id="trn-measured" className="trn-h2">Measured</h2>
              <p className="trn-measured__row">
                <span><strong>{duration(s.measured.averageSeconds)}</strong> <span className="trn-muted">average answer</span></span>
                <span><strong>{s.measured.averageWords}</strong> <span className="trn-muted">words on average</span></span>
                {s.measured.wordsPerMinute != null && <span><strong>{s.measured.wordsPerMinute}</strong> <span className="trn-muted">words per minute</span></span>}
                <span><strong>{s.measured.fillers}</strong> <span className="trn-muted">filler words in all</span></span>
              </p>
              <p className="trn-note">Counts from your answers, not grades.</p>
            </section>
          )}
        </div>
      )}

      <section className="trn-section" aria-labelledby="trn-questions">
        <h2 id="trn-questions" className="trk-label">The questions</h2>
        <div className="trn-qs">
          {s.questions.map((q, i) => (
            <QuestionBlock key={q.id} q={q} open={i === 0} ai={r.ai} englishNotes={r.englishNotes}
              wait={q.turnId ? p.waiting?.[q.turnId] : undefined} busy={p.busy !== null}
              onDismissNote={(turnId, index) => p.onDismissNote?.(turnId, index)} />
          ))}
        </div>
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
