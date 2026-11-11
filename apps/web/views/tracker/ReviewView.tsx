"use client";
/**
 * "Check before sending" (canvas "ATS Hero Tracker v2", Desktop · Agent: check before sending). The
 * filled form as the employer's page shows it, what the agent typed from the CV, and every item that
 * is the person's to answer. Nothing is sent until each one is gone through and they press Send;
 * their answers go to the form and are never saved (AGENTS.md rule 11). Presentational:
 * app/app/tracker/send/[id]/page.tsx passes the form and the handlers. Drawn as the tracker page is:
 * what the agent typed as rows under a line, the person's items on the builder's grey card, Send at
 * the right (PROVISIONAL, AGENTS.md rule 6: Liubovi draws or checks the frame).
 */
import type { Review } from "@/lib/apply/queue";
import type { Answers, PersonItem } from "@/lib/apply/plan";
import { PLATFORM_LABEL } from "@/lib/tracker";
import type { ApplyPlatform } from "@/lib/types";
import { ArrowUp } from "@/components/figma-icons";

/** Has the person gone through this item, in a way the form can take? (lib/apply/plan.ts missingAnswers, for the screen.) */
export function goneThrough(item: PersonItem, a: string | boolean | undefined): boolean {
  if (a === undefined) return false;
  if (item.kind === "checkbox") return typeof a === "boolean" && (a || !item.required);
  if (typeof a !== "string") return false;
  if (item.kind === "text") return a.trim() !== "" || !item.required;
  if (a === "") return canLeaveEmpty(item);
  return item.options.includes(a);
}

/** "Leave it empty" exists only where the form can be put back to nothing (plan.ts `fits`). */
const canLeaveEmpty = (item: PersonItem) =>
  !item.required && (item.kind === "choice" ? item.placeholder !== null : item.kind === "radio" ? item.current === null : true);

export interface ReviewViewProps {
  review: Review;
  now: number;
  answers: Answers;
  sending: boolean;
  message: { error: boolean; text: string } | null;
  onAnswer: (id: string, value: string | boolean) => void;
  onSend: () => void;
  onCancel: () => void;
}

function Item({ item, value, onAnswer }: { item: PersonItem; value: string | boolean | undefined; onAnswer: (v: string | boolean) => void }) {
  const tag = (
    <span className="trk-rv__tag">
      {item.required ? "Required" : "Optional"}{item.sensitive ? " · sensitive, not saved" : ""}
    </span>
  );
  const done = goneThrough(item, value);
  const cls = `trk-rv__item${done ? "" : " is-open"}`;
  if (item.kind === "radio" || (item.kind === "choice" && item.options.length <= 4)) {
    const options = item.kind === "choice" ? item.options.filter((o) => o !== item.placeholder) : item.options;
    const qid = `rv-q-${item.id}`;
    return (
      <div className={cls} role="radiogroup" aria-labelledby={qid} aria-required={item.required || undefined}>
        <span id={qid} className="trk-rv__q">{item.label || "A question without a name"} {tag}</span>
        <div className="trk-rv__options">
          {options.map((o) => (
            <label key={o} className="trk-check">
              <input type="radio" name={`rv-${item.id}`} checked={value === o} onChange={() => onAnswer(o)} /> {o}
            </label>
          ))}
          {canLeaveEmpty(item) && (
            <label className="trk-check">
              <input type="radio" name={`rv-${item.id}`} checked={value === ""} onChange={() => onAnswer("")} /> Leave it empty
            </label>
          )}
        </div>
      </div>
    );
  }
  if (item.kind === "choice") {
    const options = item.options.filter((o) => o !== item.placeholder);
    return (
      <label className={cls}>
        <span className="trk-rv__q">{item.label || "A question without a name"} {tag}</span>
        <select value={typeof value === "string" ? value : "__none"} onChange={(e) => onAnswer(e.target.value)}>
          <option value="__none" disabled>Choose…</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
          {canLeaveEmpty(item) && <option value="">Leave it empty</option>}
        </select>
      </label>
    );
  }
  if (item.kind === "checkbox") {
    return (
      <div className={cls}>
        <label className="trk-check trk-rv__box">
          <input type="checkbox" checked={value === true} onChange={(e) => onAnswer(e.target.checked)} />
          <span className="trk-rv__q">{item.label || "A box without a name"} {tag}</span>
        </label>
        {!item.required && value === undefined && (
          <button type="button" className="trk-link trk-link--inline" onClick={() => onAnswer(false)}>Leave it unticked</button>
        )}
      </div>
    );
  }
  return (
    <label className={cls}>
      <span className="trk-rv__q">{item.label || "A question without a name"} {tag}</span>
      <textarea rows={3} maxLength={5000} value={typeof value === "string" ? value : ""} placeholder={item.sensitive ? "Type it for this job" : ""}
        onChange={(e) => onAnswer(e.target.value)} />
      {!item.required && value === undefined && (
        <button type="button" className="trk-link trk-link--inline" onClick={() => onAnswer("")}>Leave it empty</button>
      )}
    </label>
  );
}

export default function ReviewView({ review, now, answers, sending, message, onAnswer, onSend, onCancel }: ReviewViewProps) {
  const left = review.items.filter((i) => !goneThrough(i, answers[i.id])).length;
  const minutes = Math.max(0, Math.ceil((review.readyUntil - now) / 60_000));
  const platform = PLATFORM_LABEL[review.platform as ApplyPlatform] ?? "the site";

  return (
    <div className="trk trk-rv">
      <a href="/app/tracker/send" className="trk-q__back">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        {review.role} · {review.company}
      </a>

      <div className="trk-rv__top">
        <p className="trk-q__lead">
          The agent filled what comes from your CV and attached it. Nothing is sent until you go through every item below and press Send.
          Your answers to sensitive questions are never saved.
        </p>
        <div className="trk-rv__timer" role="timer">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2" /><path d="M9 3h6" /></svg>
          {minutes > 0 ? `The form stays open ${minutes} more minute${minutes === 1 ? "" : "s"}` : "The form is closing"}
        </div>
      </div>

      <div className="trk-rv__cols">
        <div className="trk-rv__shot">
          {/* eslint-disable-next-line @next/next/no-img-element -- a private, short-lived picture from our own route */}
          <img src={`/api/apply-queue/${review.id}/screenshot`} alt={`The filled form on ${platform}, as the employer’s page shows it`} />
          <div className="trk-muted">{platform}{review.url ? ` · ${new URL(review.url).host}` : ""}</div>
        </div>

        <div className="trk-rv__side">
          <section aria-label="Filled by the agent" className="trk-rv__filled">
            <h2 className="trk-panel__h">Filled by the agent</h2>
            <div className="trk-rv__table">
              {review.filled.map((f, i) => (
                <div key={`f${i}`} className="trk-rv__line"><span>{f.label}</span><strong>{f.value}</strong><span className="trk-muted">from your CV</span></div>
              ))}
              {review.chosen.map((c, i) => (
                <div key={`c${i}`} className="trk-rv__line"><span>{c.label}</span><strong>{c.option}</strong><span className="trk-muted">from your CV</span></div>
              ))}
              {review.resume && (
                <div className="trk-rv__line">
                  <span>{review.resume.label || "Resume"}</span>
                  <strong>{review.resume.attached ? "Your CV (PDF)" : "Not attached"}</strong>
                  <span className="trk-muted">{review.resume.attached ? "attached" : "add it on the site"}</span>
                </div>
              )}
            </div>
          </section>

          <section aria-label="Your answers" className="trk-rv__answers">
            <h2 className="trk-panel__h">
              Your answers
              {review.items.length > 0 && <span className={`trk-state ${left > 0 ? "is-fair" : "is-good"}`}>{left > 0 ? `${left} left` : "all gone through"}</span>}
            </h2>
            {review.items.length === 0 ? (
              <p className="trk-muted">The form asks nothing else.</p>
            ) : (
              <div className="trk-fcard trk-rv__items">
                {review.items.map((item) => (
                  <Item key={item.id} item={item} value={answers[item.id]} onAnswer={(v) => onAnswer(item.id, v)} />
                ))}
              </div>
            )}
          </section>

          {message && <p className={message.error ? "trk-error" : "trk-q__said"} role={message.error ? "alert" : "status"}>{message.text}</p>}

          {/* the way on at the right, as on the builder's pages */}
          <div className="trk-rv__send">
            {left > 0 && <span className="trk-muted">Go through {left} more item{left === 1 ? "" : "s"} to send.</span>}
            <button type="button" className="topbtn topbtn--dark" disabled={left > 0 || sending || minutes === 0} onClick={onSend}>
              {sending ? "Sending…" : "Send application"} <ArrowUp className="topbtn__arrow--right" />
            </button>
          </div>
          <div className="trk-rv__links">
            {review.url && <a href={review.url} target="_blank" rel="noreferrer noopener" className="trk-a">Continue on the site instead</a>}
            <button type="button" className="trk-link trk-link--inline trk-rv__cancel" onClick={onCancel} disabled={sending}>Cancel, send nothing</button>
          </div>
        </div>
      </div>
    </div>
  );
}
