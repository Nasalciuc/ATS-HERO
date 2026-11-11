"use client";
/** Interview Trainer setup: the data and the handlers; views/interview/TrainerSetup.tsx draws it. */
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import SignInModal from "@/components/modals/SignInModal";
import { useApp } from "@/store/AppContext";
import { useInterviewMutations, useInterviewSetup } from "@/hooks/use-interview";
import TrainerSetup from "@/views/interview/TrainerSetup";
import TrainerBlocked, { BackLink } from "@/views/interview/TrainerBlocked";
import { sessionHref } from "@/views/interview/TrainerHome";

export default function SetupClient() {
  const { user, openCv } = useApp();
  const router = useRouter();
  const jobId = useSearchParams().get("job");
  const [cvId, setCvId] = useState<string | null>(null);
  const { result, error, refresh } = useInterviewSetup(jobId, cvId);
  const m = useInterviewMutations();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [signIn, setSignIn] = useState(false);

  let body;
  if (!user) {
    body = <TrainerBlocked kind="signed_out" onSignIn={() => setSignIn(true)} />;
  } else if (!jobId) {
    body = (
      <div className="trn">
        <BackLink />
        <p className="trn-warn" role="status">Choose a job to practice for on the <a className="trk-a" href="/app/interview">Interview Trainer</a> page.</p>
      </div>
    );
  } else if (error || (result && !result.ok)) {
    body = (
      <div className="trk-fail" role="alert">
        <p>{result && !result.ok ? result.message : "We couldn’t load this job."}</p>
        <button type="button" className="trk-btn trk-btn--ghost" onClick={() => refresh()}>Try again</button>
      </div>
    );
  } else if (!result) {
    body = <div className="dash__loading">Loading…</div>;
  } else if (!result.setup.cv) {
    body = <TrainerBlocked kind="no_cv" />;
  } else if (result.setup.used >= result.setup.limit) {
    body = <TrainerBlocked kind="limit" limit={result.setup.limit} resetsOn={result.setup.resetsOn} lastReportId={result.setup.lastReportId} />;
  } else {
    const setup = result.setup;
    body = (
      <TrainerSetup
        setup={setup}
        busy={busy}
        error={failed}
        onChangeCv={(id) => setCvId(id)}
        onOpenCv={async () => {
          if (!setup.cv) return;
          await openCv(setup.cv.id);
          router.push("/app/create");
        }}
        onStart={async (choices) => {
          if (!setup.cv) return;
          setBusy(true);
          setFailed(null);
          try {
            const r = await m.start({ applicationId: setup.job.id, cvId: setup.cv.id, ...choices });
            if (r.ok) router.push(sessionHref(r.id));
            else setFailed(r.message);
          } catch {
            setFailed("Something went wrong. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  }

  return (
    <AppShell title="Set up your practice" active="interview" section="Interview Trainer" onBack={() => router.push("/app/interview")}>
      {body}
      <SignInModal open={signIn} onClose={() => setSignIn(false)} />
    </AppShell>
  );
}
