"use client";
/** "Ready to send": the data and the handlers; views/tracker/QueueView.tsx draws it. */
import { useEffect, useState } from "react";
import AppShell from "@/components/app/AppShell";
import { useApp } from "@/store/AppContext";
import { useCvs } from "@/hooks/use-cvs";
import { useApplyQueue, useApplyQueueMutations } from "@/hooks/use-apply-queue";
import { applyAgentEnabled } from "@/lib/features";
import QueueView, { HANDOFF_TEXT } from "@/views/tracker/QueueView";

export default function SendPage() {
  const { user } = useApp();
  const cvs = useCvs();
  const { result, error, refresh } = useApplyQueue();
  const m = useApplyQueueMutations();
  const [now, setNow] = useState(() => Date.now());
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const say = (r: { ok: true } | { ok: false; message: string }, ok?: string) =>
    setMessage(r.ok ? (ok ? { error: false, text: ok } : null) : { error: true, text: r.message });

  async function prepare(id: string) {
    setPreparingId(id);
    setMessage(null);
    try {
      const r = await m.prepare(id);
      if (!r.ok) return say(r);
      if (r.status === "ready") window.location.assign(`/app/tracker/send/${id}`);
      else if (r.status === "handoff") {
        const row = result?.ok ? result.view.rows.find((x) => x.id === id) : undefined;
        await refresh();
        setMessage({ error: true, text: `Continue on the site: ${HANDOFF_TEXT[row?.reason ?? ""] ?? "the agent couldn’t finish the form"}. Nothing was sent.` });
      }
    } finally {
      setPreparingId(null);
    }
  }

  let body;
  if (!user) {
    body = <div className="dash__banner">Sign in to use the apply agent.</div>;
  } else if (!applyAgentEnabled()) {
    body = <div className="dash__banner">The apply agent isn’t available yet.</div>;
  } else if (error || (result && !result.ok)) {
    body = (
      <div className="trk-fail" role="alert">
        <p>{result && !result.ok ? result.message : "We couldn’t load your queue."}</p>
        <button type="button" className="trk-btn trk-btn--ghost" onClick={() => refresh()}>Try again</button>
      </div>
    );
  } else if (!result) {
    body = <div className="dash__loading">Loading…</div>;
  } else {
    body = (
      <QueueView
        view={result.view}
        now={now}
        cvs={(cvs ?? []).map((c) => ({ id: c.id, title: c.title }))}
        preparingId={preparingId}
        message={message}
        onLimit={async (n) => say(await m.setLimit(n), `Your limit is ${n} a day.`)}
        onPrepare={(id) => void prepare(id)}
        onRemove={async (id) => say(await m.remove(id))}
        onAdd={async (ids, cvId) => {
          const r = await m.add(ids, cvId);
          say(r, r.ok ? (r.added === 1 ? "1 job added to the queue." : `${r.added} jobs added to the queue.`) : undefined);
        }}
      />
    );
  }

  return (
    <AppShell title="Ready to send" active="tracker">
      {body}
    </AppShell>
  );
}
