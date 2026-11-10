"use client";
/**
 * The practice report: the data and the handlers; views/interview/TrainerReport.tsx draws it.
 *
 * When the interviewer was the model and the session has ended, the answers that have no feedback yet
 * get it here, one request at a time ("Feedback at the end", an interview ended mid-answer, or a
 * moment the model couldn't be asked): the report fills in as each comes back. An answer is asked
 * for once; if the model can't be had, the page stops and says so, and "Try again" starts over.
 */
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import SignInModal from "@/components/modals/SignInModal";
import { useApp } from "@/store/AppContext";
import { useInterviewMutations, useInterviewReport } from "@/hooks/use-interview";
import type { InterviewPrepared } from "@/lib/types";
import TrainerReport, { type ReportWait } from "@/views/interview/TrainerReport";
import TrainerBlocked from "@/views/interview/TrainerBlocked";
import { sessionHref, setupHref } from "@/views/interview/TrainerHome";

export default function ReportClient() {
  const { id } = useParams<{ id: string }>();
  const { user, openCv } = useApp();
  const router = useRouter();
  const { result, error, refresh } = useInterviewReport(id ?? null);
  const m = useInterviewMutations();
  const [busy, setBusy] = useState<"again" | "delete" | "prepared" | "note" | null>(null);
  const [waiting, setWaiting] = useState<Record<string, ReportWait>>({});
  /** the answers already asked for, so none is asked twice on its own */
  const asked = useRef(new Set<string>());
  const asking = useRef(false);
  /** goes up when a request ends or "Try again" is chosen: the next answer is looked for again */
  const [round, setRound] = useState(0);
  const feedbackRef = useRef(m.feedback);
  feedbackRef.current = m.feedback;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [signIn, setSignIn] = useState(false);
  const [now] = useState(() => Date.now());
  const report = result?.ok ? result.report : null;

  // the model's feedback on the answers that don't have it yet, one at a time
  useEffect(() => {
    if (!report || !report.ai || report.status !== "done" || asking.current) return;
    const missing = report.summary.questions.flatMap((q) => (q.state === "answered" && !q.ai && q.turnId ? [q.turnId] : []));
    const next = missing.find((t) => !asked.current.has(t));
    if (!next) return;
    asking.current = true;
    asked.current.add(next);
    setWaiting((w) => ({ ...w, [next]: "loading" }));
    void feedbackRef.current(report.id, next).then((r) => r, () => null).then(async (r) => {
      if (r?.ok && r.ai === "ready") {
        await refreshRef.current();
        setWaiting((w) => {
          const rest = { ...w };
          delete rest[next];
          return rest;
        });
      } else {
        // not to be had now: the same would come back for the rest, so none of them is asked
        for (const t of missing) asked.current.add(t);
        setWaiting(Object.fromEntries(missing.map((t) => [t, "unavailable" as const])));
      }
      asking.current = false;
      setRound((x) => x + 1);
    });
  }, [report, round]);

  async function run(kind: "again" | "delete" | "prepared" | "note", fn: () => Promise<boolean>) {
    setBusy(kind);
    setMessage(null);
    try {
      if (!(await fn())) setBusy(null);
    } catch {
      setMessage("Something went wrong. Try again.");
      setBusy(null);
    }
  }

  let body;
  if (!user) {
    body = <TrainerBlocked kind="signed_out" onSignIn={() => setSignIn(true)} />;
  } else if (error || (result && !result.ok)) {
    body = (
      <div className="trk-fail" role="alert">
        <p>{result && !result.ok ? result.message : "We couldn’t load this report."}</p>
        <button type="button" className="trk-btn trk-btn--ghost" onClick={() => refresh()}>Try again</button>
      </div>
    );
  } else if (!report) {
    body = <div className="dash__loading">Loading…</div>;
  } else {
    body = (
      <TrainerReport
        report={report}
        now={now}
        busy={busy}
        confirmDelete={confirmDelete}
        message={message}
        waiting={waiting}
        onDismissNote={(turnId, index) => run("note", async () => {
          const r = await m.dismissNote(report.id, { turnId, index });
          if (!r.ok) setMessage(r.message);
          await refresh();
          return false;
        })}
        onAskAgain={() => {
          asked.current.clear();
          setWaiting({});
          setRound((x) => x + 1);
        }}
        onPracticeThese={() => run("again", async () => {
          const r = await m.again(report.id);
          if (r.ok) {
            router.push(sessionHref(r.id));
            return true;
          }
          setMessage(r.message);
          return false;
        })}
        onAskDelete={() => setConfirmDelete(true)}
        onCancelDelete={() => setConfirmDelete(false)}
        onDelete={() => run("delete", async () => {
          const r = await m.remove(report.id);
          if (r.ok) {
            router.push("/app/interview");
            return true;
          }
          setMessage(r.message);
          return false;
        })}
        onPrepared={(value: InterviewPrepared) => run("prepared", async () => {
          const r = await m.prepared(report.id, value);
          if (!r.ok) setMessage(r.message);
          await refresh();
          return false;
        })}
        onOpenCv={async () => {
          await openCv(report.cvId);
          router.push("/app/create");
        }}
      />
    );
  }

  return (
    <AppShell
      title="Practice report"
      active="interview"
      section="Interview Trainer"
      onBack={() => router.push("/app/interview")}
      actions={report ? (
        <>
          <button type="button" className="topbtn topbtn--ghost topbtn--no-phone" onClick={() => window.print()}>Print</button>
          <a className="topbtn topbtn--dark" href={setupHref(report.applicationId)}>
            {/* on a phone the title buttons are icons; the label stays for screen readers */}
            <svg className="trn-phone-only" aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /></svg>
            <span className="topbtn__label">Practice again</span>
          </a>
        </>
      ) : undefined}
    >
      {body}
      <SignInModal open={signIn} onClose={() => setSignIn(false)} />
    </AppShell>
  );
}
