"use client";
/**
 * The interview, typed: the questions in order, the clock, pause and skip, and the feedback after each
 * answer (or none until the report, IV-15). views/interview/TrainerLive.tsx draws it.
 *
 * The clock runs only while a question waits for its answer: pausing, reading the feedback and
 * "Try this answer again" don't use the interview's time (§12.2). The page says how long it ran and
 * the server keeps at most the time since the session started. A tab put in the background pauses.
 */
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import SignInModal from "@/components/modals/SignInModal";
import { useApp } from "@/store/AppContext";
import { useInterview, useInterviewMutations } from "@/hooks/use-interview";
import type { LiveSession, LiveTurn } from "@/app/actions/interview";
import TrainerLive, { TrainerFeedback, type TranscriptLine } from "@/views/interview/TrainerLive";
import TrainerBlocked from "@/views/interview/TrainerBlocked";
import { reportHref } from "@/views/interview/TrainerHome";

type Phase = "answering" | "paused" | "feedback" | "finished";

/** Seconds that add up while `running`, and stop when it isn't. */
function useStopwatch(running: boolean) {
  const base = useRef(0);
  const since = useRef<number | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    since.current = Date.now();
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => {
      clearInterval(t);
      if (since.current != null) base.current += (Date.now() - since.current) / 1000;
      since.current = null;
    };
  }, [running]);
  return {
    read: () => base.current + (since.current != null ? (Date.now() - since.current) / 1000 : 0),
    reset: (to = 0) => {
      base.current = to;
      if (since.current != null) since.current = Date.now();
    },
  };
}

export default function LiveClient() {
  const { id } = useParams<{ id: string }>();
  const { user } = useApp();
  const router = useRouter();
  const { result, error, refresh } = useInterview(id ?? null);
  const m = useInterviewMutations();
  const [view, setView] = useState<LiveSession | null>(null);
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [phase, setPhase] = useState<Phase>("answering");
  const [feedback, setFeedback] = useState<{ turn: LiveTurn; last: boolean } | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(true);
  const [signIn, setSignIn] = useState(false);
  const loaded = view !== null;
  const interview = useStopwatch(loaded && phase === "answering" && !retrying);
  const answer = useStopwatch(loaded && phase === "answering");

  // the session, once: the page keeps its own state from here
  useEffect(() => {
    if (view || !result?.ok) return;
    const s = result.session;
    if (s.status === "done") {
      router.replace(reportHref(s.id));
      return;
    }
    interview.reset(s.secondsUsed);
    setView(s);
    setTurns(s.turns);
    const open = s.questions.some((q) => !s.turns.some((t) => t.questionId === q.id));
    setPhase(!open ? "finished" : s.status === "paused" ? "paused" : "answering");
  }, [result, view, router, interview]);

  const next = view?.questions.find((q) => !turns.some((t) => t.questionId === q.id)) ?? null;
  const current = retrying ? view?.questions.find((q) => q.id === retrying) ?? null : next;
  const used = () => Math.round(interview.read());
  const timeLeft = view ? view.minutes * 60 - interview.read() : 0;

  async function finish() {
    if (!view) return;
    setBusy(true);
    const r = await m.end(view.id, used()).catch(() => null);
    if (r?.ok) {
      router.push(reportHref(view.id));
      return;
    }
    setFailed(r && !r.ok ? r.message : "The interview didn’t end. Check your connection and try again.");
    setBusy(false);
  }

  async function send() {
    if (!view || !current) return;
    setBusy(true);
    setFailed(null);
    try {
      const r = await m.answer(view.id, { questionId: current.id, answer: draft, seconds: Math.round(answer.read()), secondsUsed: used() });
      if (!r.ok) return setFailed(r.message);
      const all = [...turns, r.turn];
      setTurns(all);
      setDraft("");
      setRetrying(null);
      answer.reset(0);
      const last = !view.questions.some((q) => !all.some((t) => t.questionId === q.id)) || interview.read() >= view.minutes * 60;
      if (view.feedbackWhen === "each") {
        setFeedback({ turn: r.turn, last });
        setPhase("feedback");
      } else if (last) {
        await finish();
      }
    } catch {
      setFailed("Your answer didn’t send. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function pause(paused: boolean) {
    if (!view) return;
    setFailed(null);
    setPhase(paused ? "paused" : "answering");
    const r = await m.pause(view.id, paused, used()).catch(() => null);
    if (!r?.ok) setFailed(r && !r.ok ? r.message : "We couldn’t save the pause. Your answers so far are saved.");
  }

  async function skip() {
    if (!view || !next) return;
    setBusy(true);
    setFailed(null);
    try {
      const r = await m.skip(view.id, { questionId: next.id, secondsUsed: used() });
      if (!r.ok) return setFailed(r.message);
      const all = [...turns, r.turn];
      setTurns(all);
      answer.reset(0);
      const last = !view.questions.some((q) => !all.some((t) => t.questionId === q.id)) || interview.read() >= view.minutes * 60;
      if (last) await finish();
      else setPhase("answering");
    } catch {
      setFailed("We couldn’t skip it. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  // a tab put in the background pauses the interview (B8)
  const pauseRef = useRef(pause);
  pauseRef.current = pause;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && phaseRef.current === "answering") void pauseRef.current(true);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  if (!user || error || (result && !result.ok)) {
    return (
      <AppShell title="Interview Trainer" active="interview">
        {!user ? (
          <TrainerBlocked kind="signed_out" onSignIn={() => setSignIn(true)} />
        ) : (
          <div className="trk-fail" role="alert">
            <p>{result && !result.ok ? result.message : "We couldn’t load this interview."}</p>
            <button type="button" className="trk-btn trk-btn--ghost" onClick={() => refresh()}>Try again</button>
          </div>
        )}
        <SignInModal open={signIn} onClose={() => setSignIn(false)} />
      </AppShell>
    );
  }
  if (!view) return <div className="trn trn-live"><div className="dash__loading">Loading…</div></div>;

  const total = view.questions.length;
  if (phase === "feedback" && feedback) {
    const q = view.questions.find((x) => x.id === feedback.turn.questionId);
    const named = new Set(turns.flatMap((t) => t.named));
    const ahead = [...new Set(view.questions
      .filter((x) => x.requirement && !turns.some((t) => t.questionId === x.id))
      .map((x) => x.requirement as string))].filter((r) => !named.has(r));
    return (
      <TrainerFeedback
        session={view}
        n={q ? view.questions.indexOf(q) + 1 : total}
        total={total}
        question={q ?? { text: "", requirement: null }}
        turn={feedback.turn}
        ahead={ahead}
        last={feedback.last}
        canRetry={turns.filter((t) => t.questionId === feedback.turn.questionId).length < view.maxTries}
        timeLeft={timeLeft}
        busy={busy}
        error={failed}
        onNext={() => {
          if (feedback.last) return void finish();
          setFeedback(null);
          answer.reset(0);
          setPhase("answering");
        }}
        onRetry={() => {
          setRetrying(feedback.turn.questionId);
          setFeedback(null);
          setDraft("");
          answer.reset(0);
          setPhase("answering");
        }}
        onEnd={() => void finish()}
      />
    );
  }

  const transcript: TranscriptLine[] = [];
  for (const q of view.questions) {
    const mine = turns.filter((t) => t.questionId === q.id);
    if (!mine.length && current?.id !== q.id) continue;
    transcript.push({ who: "interviewer", text: q.text });
    for (const t of mine) transcript.push({ who: "you", text: t.answer ?? "", skipped: t.answer == null });
  }

  return (
    <TrainerLive
      session={view}
      phase={phase === "feedback" ? "answering" : phase}
      n={current ? view.questions.indexOf(current) + 1 : total}
      total={total}
      question={current}
      timeLeft={timeLeft}
      answerSeconds={answer.read()}
      retrying={retrying !== null}
      draft={draft}
      onDraft={setDraft}
      transcript={transcript}
      showTranscript={showTranscript}
      onToggleTranscript={() => setShowTranscript((x) => !x)}
      busy={busy}
      error={failed}
      onSend={() => void send()}
      onPause={() => void pause(true)}
      onResume={() => void pause(false)}
      onSkip={() => void skip()}
      onEnd={() => void finish()}
      onReport={() => void finish()}
    />
  );
}
