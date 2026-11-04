"use client";
/**
 * "Ready to send" (canvas "ATS Hero Tracker v2", page "Search & agent": Desktop · Ready to send, with
 * the daily limit; Phone · Ready to send). Presentational: app/app/tracker/send/page.tsx passes the
 * queue and the handlers.
 */
import { useState } from "react";
import type { QueueRow, QueueView as View } from "@/lib/apply/queue";
import { PLATFORM_LABEL, shortDate } from "@/lib/tracker";
import type { ApplyPlatform } from "@/lib/types";

export const LIMIT_CHOICES = [1, 2, 3, 5, 8, 10];

/** Why the agent handed a form over, in the person's words. */
export const HANDOFF_TEXT: Record<string, string> = {
  captcha: "the form asks you to prove you’re human",
  email_code: "the form sends a code to your e-mail",
  login: "the form asks you to sign in",
  no_form: "we found no application form on the page",
  unsupported_field: "the form has a field the agent can’t fill",
  resume_not_attached: "the agent couldn’t attach your CV",
};
const REFUSED_TEXT: Record<string, string> = {
  linkedin: "the agent never applies on LinkedIn",
  indeed: "the agent doesn’t use Indeed Apply",
  workday: "the agent doesn’t apply on Workday",
  unsupported: "the agent works only on Greenhouse, Lever and Ashby",
  invalid_url: "the job’s link doesn’t work",
  not_saved: "this job isn’t in Saved any more",
  not_https: "the job’s link isn’t secure (https)",
};

const time = (at: number) => new Date(at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const sentWhen = (at: number, now: number) =>
  new Date(at).toDateString() === new Date(now).toDateString() ? `today, ${time(at)}` : `${shortDate(at)}, ${time(at)}`;
const minutesLeft = (until: number | null, now: number) => Math.max(1, Math.ceil(((until ?? now) - now) / 60_000));
const platform = (p: string) => PLATFORM_LABEL[p as ApplyPlatform] ?? "Site";
/** When the day's count starts again: the next UTC midnight, in the person's own time. */
export const countResetsAt = (now: number) => time(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate() + 1));

export interface QueueViewProps {
  view: View;
  now: number;
  cvs: { id: string; title: string }[];
  /** the row the agent is filling right now, from this page */
  preparingId: string | null;
  message: { error: boolean; text: string } | null;
  onLimit: (limit: number) => void;
  onPrepare: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: (applicationIds: string[], cvId: string | null) => void;
}

function Status({ r, now, preparing }: { r: QueueRow; now: number; preparing: boolean }) {
  if (preparing || r.status === "preparing") return <><strong>Filling the form…</strong> Stay on this page or come back in a minute.</>;
  switch (r.status) {
    case "ready":
      return <><span className="trk-q__ready">Filled. Check it before sending.</span> The form stays open {minutesLeft(r.readyUntil, now)} more minutes.</>;
    case "waiting":
      if (r.reason === "expired") return <>The form closed before you sent it. Nothing was sent. Prepare it again when you’re ready.</>;
      if (r.reason === "interrupted") return <>The agent stopped before it finished. Nothing was sent. Prepare it again.</>;
      return <>Waiting. The agent opens the form and fills it when you press Prepare: about a minute.</>;
    case "handoff":
      return <><span className="trk-q__warn">Continue on the site:</span> {HANDOFF_TEXT[r.reason ?? ""] ?? "the agent couldn’t finish the form"}. Nothing was sent.</>;
    case "refused":
      return <><span className="trk-q__warn">Apply on the site:</span> {REFUSED_TEXT[r.reason ?? ""] ?? "the agent doesn’t go to this site"}.</>;
    case "failed":
      return <>The agent stopped before anything was sent. Try again, or apply on the site.</>;
    case "sending":
      return <><strong>Sending…</strong></>;
    case "sent":
      return <><span className="trk-q__sent">Sent {r.sentAt ? sentWhen(r.sentAt, now) : ""}</span>, after you checked it. It moved to Applied.</>;
    case "unconfirmed":
      if (r.reason && HANDOFF_TEXT[r.reason])
        return <><span className="trk-q__warn">Send was pressed, then {HANDOFF_TEXT[r.reason]}.</span> Check the site or your e-mail before you apply again.</>;
      return <><span className="trk-q__warn">Send was pressed, but the page didn’t confirm it.</span> Check your e-mail or the site before you apply again.</>;
  }
}

export default function QueueView({ view, now, cvs, preparingId, message, onLimit, onPrepare, onRemove, onAdd }: QueueViewProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const [cvId, setCvId] = useState<string>("");
  const atLimit = view.sentToday >= view.dailyLimit;
  const resetsAt = countResetsAt(now);
  const busy = preparingId !== null || view.rows.some((r) => r.status === "preparing");
  const choices = LIMIT_CHOICES.includes(view.dailyLimit) ? LIMIT_CHOICES : [...LIMIT_CHOICES, view.dailyLimit].sort((a, b) => a - b);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div className="trk trk-q">
      <a href="/app/tracker" className="trk-q__back">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        Tracker
      </a>

      <div className="trk-q__top">
        <p className="trk-q__lead">The agent fills one form at a time, from your CV. You check each one and press Send. Nothing goes out on its own.</p>
        <div className="trk-q__limit">
          <div className="trk-q__count"><strong>Sent today: {view.sentToday}</strong> <span className="trk-muted">of {view.dailyLimit}</span></div>
          <label className="trk-field">
            <span>Daily limit</span>
            <select value={view.dailyLimit} onChange={(e) => onLimit(Number(e.target.value))}>
              {choices.map((n) => <option key={n} value={n}>{n} a day</option>)}
            </select>
          </label>
        </div>
      </div>

      {atLimit && (
        <section className="trk-q__banner" aria-label="Daily limit reached">
          <strong>You sent {view.sentToday} of {view.dailyLimit} today.</strong> The jobs below wait until {resetsAt}, when the count starts again. You set this limit; you can change it above.
        </section>
      )}

      {message && <p className={message.error ? "trk-error" : "trk-q__said"} role={message.error ? "alert" : "status"}>{message.text}</p>}

      {view.rows.length > 0 ? (
        <section className="trk-q__list" aria-label="Queue">
          <h2 className="trk-label">In the queue · {view.rows.length}</h2>
          {view.rows.map((r) => {
            const preparing = preparingId === r.id;
            const canPrepare = ["waiting", "handoff", "failed"].includes(r.status) && !preparing;
            return (
              <div key={r.id} className="trk-q__row">
                <div className="trk-q__job">
                  <div className="trk-q__role">{r.role} <span className="trk-muted">· {r.company}{r.location ? ` · ${r.location}` : ""}</span></div>
                  <div className="trk-tile__chips"><span className="trk-chip">{platform(r.platform)}</span></div>
                </div>
                <div className="trk-q__status"><Status r={r} now={now} preparing={preparing} /></div>
                <div className="trk-q__actions">
                  {r.status === "ready" && !preparing && (
                    <a href={`/app/tracker/send/${r.id}`} className="trk-btn trk-q__btn">Check and send</a>
                  )}
                  {canPrepare && (
                    atLimit
                      ? <button type="button" className="trk-pill trk-q__btn" disabled>After {resetsAt}</button>
                      : <button type="button" className="trk-pill trk-q__btn" disabled={busy} onClick={() => onPrepare(r.id)}>{r.status === "waiting" ? "Prepare" : "Try again"}</button>
                  )}
                  {(r.status === "handoff" || r.status === "refused" || r.status === "unconfirmed") && r.url && (
                    <a href={r.url} target="_blank" rel="noreferrer noopener" className="trk-pill trk-q__btn trk-q__site">Open the form</a>
                  )}
                  {!["preparing", "sending", "sent"].includes(r.status) && !preparing && (
                    <button type="button" className="trk-text-btn trk-q__remove" aria-label={`Take ${r.role} at ${r.company} out of the queue`} onClick={() => onRemove(r.id)}>Remove</button>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <section className="trk-q__empty" aria-label="Empty queue">
          <h2>Nothing in the queue</h2>
          <p>Pick jobs from Saved below. The agent can prepare jobs on Greenhouse, Lever and Ashby.</p>
        </section>
      )}

      <section className="trk-q__add" aria-label="Add from Saved">
        <div className="trk-q__add-head">
          <h2>From Saved, the agent can prepare</h2>
          <button type="button" className="trk-btn trk-q__btn" disabled={picked.length === 0} onClick={() => { onAdd(picked, cvId || null); setPicked([]); }}>
            {picked.length === 0 ? "Add to the queue" : `Add ${picked.length} to the queue`}
          </button>
        </div>
        {view.candidates.length === 0 ? (
          <p className="trk-muted">No Saved job on Greenhouse, Lever or Ashby yet. The daily search and Add job put them there.</p>
        ) : (
          <>
            {view.candidates.map((c) => (
              <label key={c.applicationId} className="trk-check">
                <input type="checkbox" checked={picked.includes(c.applicationId)} onChange={() => toggle(c.applicationId)} />
                <span><strong>{c.role}</strong> · {c.company} <span className="trk-muted">· {platform(c.platform)}</span></span>
              </label>
            ))}
            {cvs.length > 0 && (
              <label className="trk-field trk-q__cv">
                <span>The CV the agent attaches</span>
                <select value={cvId} onChange={(e) => setCvId(e.target.value)}>
                  <option value="">The CV you changed last</option>
                  {cvs.map((cv) => <option key={cv.id} value={cv.id}>{cv.title}</option>)}
                </select>
              </label>
            )}
          </>
        )}
        {view.notForAgent > 0 && (
          <p className="trk-q__note">
            Not here: {view.notForAgent === 1 ? "1 saved job" : `${view.notForAgent} saved jobs`} on Workday, Indeed Apply, LinkedIn or another site. You apply to those on the site.
          </p>
        )}
      </section>
    </div>
  );
}
