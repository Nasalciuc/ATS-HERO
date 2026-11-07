"use client";
/** Interview Trainer home: the data and the handlers; views/interview/TrainerHome.tsx draws it. */
import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import SignInModal from "@/components/modals/SignInModal";
import { useApp } from "@/store/AppContext";
import { useApplicationMutations, useApplications } from "@/hooks/use-applications";
import { useTrainerHome } from "@/hooks/use-interview";
import AddJobDialog from "@/views/tracker/AddJobDialog";
import TrainerHome, { LimitChip, setupHref } from "@/views/interview/TrainerHome";
import TrainerBlocked from "@/views/interview/TrainerBlocked";

/** What was pasted: a link goes in the link field, anything else is the post's text. */
function pasted(text: string): { url?: string; description?: string } {
  const t = text.trim();
  if (!t) return {};
  return /^https?:\/\/\S+$/i.test(t) ? { url: t } : { description: t };
}

export default function HomeClient() {
  const { user } = useApp();
  const router = useRouter();
  const { result, error, refresh } = useTrainerHome();
  const { jobs } = useApplications();
  const m = useApplicationMutations();
  const [paste, setPaste] = useState("");
  const [adding, setAdding] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [now] = useState(() => Date.now());

  let body;
  if (!user) {
    body = <TrainerBlocked kind="signed_out" back={false} onSignIn={() => setSignIn(true)} />;
  } else if (error || (result && !result.ok)) {
    body = (
      <div className="trk-fail" role="alert">
        <p>{result && !result.ok ? result.message : "We couldn’t load the Interview Trainer."}</p>
        <button type="button" className="trk-btn trk-btn--ghost" onClick={() => refresh()}>Try again</button>
      </div>
    );
  } else if (!result) {
    body = <div className="dash__loading">Loading…</div>;
  } else {
    body = <TrainerHome home={result.home} now={now} paste={paste} onPaste={setPaste} onAddAndPractice={() => setAdding(true)} />;
  }

  return (
    <AppShell
      title="Interview Trainer"
      active="interview"
      actions={result?.ok ? <LimitChip used={result.home.used} limit={result.home.limit} /> : undefined}
    >
      {body}
      <AddJobDialog
        open={adding}
        practice
        initial={pasted(paste)}
        jobs={jobs ?? []}
        onClose={() => setAdding(false)}
        onAdd={async (j) => {
          const made = await m.create({ url: j.url, company: j.company, role: j.role, description: j.description, status: "saved" });
          setAdding(false);
          setPaste("");
          router.push(setupHref(made.id));
          return made;
        }}
        onOpenJob={(id) => {
          setAdding(false);
          router.push(setupHref(id));
        }}
      />
      <SignInModal open={signIn} onClose={() => setSignIn(false)} />
    </AppShell>
  );
}
