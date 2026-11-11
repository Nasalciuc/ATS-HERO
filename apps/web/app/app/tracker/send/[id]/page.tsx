"use client";
/** "Check before sending": the data and the handlers; views/tracker/ReviewView.tsx draws it. */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import { useApp } from "@/store/AppContext";
import { useApplyQueueMutations, useReview } from "@/hooks/use-apply-queue";
import { applyAgentEnabled } from "@/lib/features";
import type { Answers } from "@/lib/apply/plan";
import ReviewView from "@/views/tracker/ReviewView";
import { countResetsAt, HANDOFF_TEXT } from "@/views/tracker/QueueView";

type Done = { kind: "sent"; text: string } | { kind: "stopped"; text: string; url?: string | null };

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useApp();
  const { result, refresh } = useReview(id ?? null);
  const m = useApplyQueueMutations();
  const [answers, setAnswers] = useState<Answers>({});
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const review = result?.ok ? result.review : null;

  async function send() {
    if (!review) return;
    setSending(true);
    setMessage(null);
    try {
      const r = await m.send(review.id, { digest: review.digest, answers });
      if (!r.ok) return setMessage({ error: true, text: r.message });
      const o = r.outcome;
      switch (o.status) {
        case "sent":
          return setDone({ kind: "sent", text: `Sent. ${review.company} got your application; the page said “${o.confirmation}”. It moved to Applied.` });
        case "missing":
          return setMessage({ error: true, text: `Nothing was sent. The form still needs: ${o.labels.join("; ") || "an answer"}.` });
        case "changed":
          setAnswers({});
          await refresh();
          return setMessage({ error: true, text: "Nothing was sent: the form asked something new after your answers. Check it again." });
        case "limit":
          return setMessage({ error: true, text: `Nothing was sent: you sent ${o.sent} of ${o.limit} today. Change your limit in Ready to send, or send this one after ${countResetsAt(Date.now())}.` });
        case "handoff":
          return setDone({ kind: "stopped", text: `Continue on the site: ${HANDOFF_TEXT[o.reason] ?? "the agent couldn’t finish the form"}.`, url: o.url });
        case "unconfirmed":
          return setDone({
            kind: "stopped",
            text: o.reason && HANDOFF_TEXT[o.reason]
              ? `Send was pressed, then ${HANDOFF_TEXT[o.reason]}. Check the site or your e-mail before you apply again.`
              : "Send was pressed, but the page didn’t confirm it. Check your e-mail or the site before you apply again.",
            url: review.url,
          });
        case "closed":
          return setDone({ kind: "stopped", text: "The form closed before it was sent. Nothing was sent. Prepare it again from Ready to send." });
      }
    } finally {
      setSending(false);
    }
  }

  async function cancel() {
    if (review) await m.cancel(review.id);
    window.location.assign("/app/tracker/send");
  }

  let body;
  if (!user) body = <div className="dash__banner">Sign in to use the apply agent.</div>;
  else if (!applyAgentEnabled()) body = <div className="dash__banner">The apply agent isn’t available yet.</div>;
  else if (done) {
    body = (
      <div className={`trk-rv__done${done.kind === "sent" ? " is-sent" : ""}`} role="status">
        <p>{done.text}</p>
        <div className="trk-rv__links">
          {done.kind === "stopped" && done.url && <a href={done.url} target="_blank" rel="noreferrer noopener" className="trk-a">Open the form</a>}
          <a href="/app/tracker/send" className="trk-a">Back to Ready to send</a>
        </div>
      </div>
    );
  } else if (!result) body = <div className="dash__loading">Loading…</div>;
  else if (!result.ok) body = <div className="trk-fail" role="alert"><p>{result.message}</p></div>;
  else if (!review) {
    body = (
      <div className="trk-fail" role="status">
        <p>This form isn’t open any more. Nothing was sent.</p>
        <a href="/app/tracker/send" className="trk-a">Back to Ready to send</a>
      </div>
    );
  } else {
    body = (
      <ReviewView
        review={review}
        now={now}
        answers={answers}
        sending={sending}
        message={message}
        onAnswer={(itemId, v) => setAnswers((a) => ({ ...a, [itemId]: v }))}
        onSend={() => void send()}
        onCancel={() => void cancel()}
      />
    );
  }

  return (
    <AppShell title="Check before sending" active="tracker">
      {body}
    </AppShell>
  );
}
