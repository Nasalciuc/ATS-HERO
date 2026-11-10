"use client";
/**
 * Interview Trainer: when a practice can't start (canvas "ATS Hero Tracker v2", page "Interview trainer",
 * Desktop · Can't start). Each state says why and what to do next (B8): the month's sessions are used,
 * nobody is signed in, or there is no CV to ask from. The blocked microphone comes with speaking
 * (step 6); there is no free session to run out of (IV-9, Scaler, Nov 2026).
 */
import { resetDay } from "./format";
import { reportHref } from "./TrainerHome";

export function BackLink() {
  return (
    <a className="trn-back" href="/app/interview">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
      Interview Trainer
    </a>
  );
}

const FLOW = [
  { label: "Set up", emoji: "🎯" },
  { label: "Interview", emoji: "🎤" },
  { label: "Report", emoji: "📋" },
];

/**
 * Where a practice is: set up, the interview, the report. The Improve and Job Fit flow's progress
 * bar (components/app/AnalyzeSteps.tsx), with the trainer's three steps; `current` is 0, 1 or 2.
 */
export function TrainerSteps({ current }: { current: number }) {
  return (
    <ol className="analyze-steps trn-flow" aria-label="Progress">
      {FLOW.map((s, i) => {
        const state = i === current ? " is-current" : i < current ? " is-done" : "";
        return [
          i > 0 && <li key={`${s.label}-line`} className={`analyze-step__line${i <= current ? " is-filled" : ""}`} aria-hidden="true" />,
          <li key={s.label} className="analyze-step" aria-current={i === current ? "step" : undefined}>
            <span className={`analyze-step__node${state}`}><span className="analyze-step__emoji" aria-hidden="true">{s.emoji}</span></span>
            <span className={`analyze-step__label${state}`}>{s.label}</span>
          </li>,
        ];
      })}
    </ol>
  );
}

export type BlockedKind = "limit" | "signed_out" | "no_cv";

export interface TrainerBlockedProps {
  kind: BlockedKind;
  limit?: number;
  resetsOn?: number;
  lastReportId?: string | null;
  onSignIn?: () => void;
  /** the home page itself shows no link back to it */
  back?: boolean;
}

function Icon({ kind }: { kind: BlockedKind }) {
  return (
    <span className="trn-blocked__icon" aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {kind === "limit" && <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M4 10h16" /></>}
        {kind === "signed_out" && <><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>}
        {kind === "no_cv" && <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /><path d="M10 13h6" /><path d="M10 17h6" /></>}
      </svg>
    </span>
  );
}

export default function TrainerBlocked({ kind, limit = 20, resetsOn, lastReportId, onSignIn, back = true }: TrainerBlockedProps) {
  const day = resetsOn != null ? resetDay(resetsOn) : "the 1st";
  return (
    <div className="trn trn-blocked">
      {back && <BackLink />}
      <section className="trn-blocked__card" aria-labelledby="trn-blocked-title">
        <Icon kind={kind} />
        {kind === "limit" && (
          <>
            <h2 id="trn-blocked-title" className="trn-blocked__title">You’ve used your {limit} sessions this month</h2>
            <p className="trn-blocked__lead">During the beta everyone gets {limit} practice sessions a month. They come back on {day}.</p>
            <p className="trn-blocked__box">Your reports stay here, and “Practice these again” works again on <strong>{day}</strong>.</p>
            <div className="trn-blocked__actions">
              {lastReportId
                ? <a className="trk-btn" href={reportHref(lastReportId)}>Read your last report</a>
                : <a className="trk-btn" href="/app/interview">Back to the Interview Trainer</a>}
            </div>
          </>
        )}
        {kind === "signed_out" && (
          <>
            <h2 id="trn-blocked-title" className="trn-blocked__title">Sign in to practice</h2>
            <p className="trn-blocked__lead">
              The trainer uses the jobs in your Tracker and keeps your reports, so it needs an account. Signing in keeps the CV
              you made as a guest.
            </p>
            <div className="trn-blocked__actions">
              <button type="button" className="trk-btn" onClick={onSignIn}>Sign in</button>
              <a className="trk-a" href="/app/improve">Check a CV without an account</a>
            </div>
          </>
        )}
        {kind === "no_cv" && (
          <>
            <h2 id="trn-blocked-title" className="trn-blocked__title">Make a CV first</h2>
            <p className="trn-blocked__lead">
              Every question comes from a line of your CV, so the trainer needs a CV you made in ATS Hero.
            </p>
            <div className="trn-blocked__actions">
              <a className="trk-btn" href="/app/create">Create a CV</a>
            </div>
          </>
        )}
      </section>
      <p className="trn-foot">For practice only. ATS Hero never joins or helps during a real interview.</p>
    </div>
  );
}
