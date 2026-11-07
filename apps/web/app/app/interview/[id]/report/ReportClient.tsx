"use client";
/** The practice report: the data and the handlers; views/interview/TrainerReport.tsx draws it. */
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import SignInModal from "@/components/modals/SignInModal";
import { useApp } from "@/store/AppContext";
import { useInterviewMutations, useInterviewReport } from "@/hooks/use-interview";
import type { InterviewPrepared } from "@/lib/types";
import TrainerReport from "@/views/interview/TrainerReport";
import TrainerBlocked from "@/views/interview/TrainerBlocked";
import { sessionHref, setupHref } from "@/views/interview/TrainerHome";

export default function ReportClient() {
  const { id } = useParams<{ id: string }>();
  const { user, openCv } = useApp();
  const router = useRouter();
  const { result, error, refresh } = useInterviewReport(id ?? null);
  const m = useInterviewMutations();
  const [busy, setBusy] = useState<"again" | "delete" | "prepared" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [signIn, setSignIn] = useState(false);
  const [now] = useState(() => Date.now());
  const report = result?.ok ? result.report : null;

  async function run(kind: "again" | "delete" | "prepared", fn: () => Promise<boolean>) {
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
