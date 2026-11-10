"use client";
/**
 * The interview, typed: the questions in order, the clock, pause and skip, and the feedback after each
 * answer (or none until the report, IV-15). views/interview/TrainerLive.tsx draws it.
 *
 * The clock runs only while a question waits for its answer: pausing, reading the feedback, "Try this
 * answer again" and the moments the interviewer takes to read an answer don't use the interview's
 * time (§12.2). The page says how long it ran and the server keeps at most the time since the session
 * started. A tab put in the background pauses.
 *
 * With the model (step 5), an answer is sent and stored first; then the page asks whether the
 * interviewer has a follow-up, and after the last answer to a question, for the feedback. Each is its
 * own request: if one fails, the answer is already saved and the interview goes on.
 */
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import SignInModal from "@/components/modals/SignInModal";
import { useApp } from "@/store/AppContext";
import { useInterview, useInterviewMutations } from "@/hooks/use-interview";
import type { LiveSession, LiveTurn } from "@/app/actions/interview";
import type { InterviewPending } from "@/lib/types";
import TrainerLive, { TrainerFeedback, type AiState, type TranscriptLine } from "@/views/interview/TrainerLive";
import TrainerBlocked from "@/views/interview/TrainerBlocked";
import { reportHref } from "@/views/interview/TrainerHome";

type Phase = "answering" | "thinking" | "paused" | "feedback" | "finished";

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

/** The tries with this one in: in its place when it is already there (a follow-up's answer, its feedback), else at the end. */
const withTurn = (all: LiveTurn[], t: LiveTurn) => (all.some((x) => x.id === t.id) ? all.map((x) => (x.id === t.id ? t : x)) : [...all, t]);

export default function LiveClient() {
  const { id } = useParams<{ id: string }>();
  const { user } = useApp();
  const router = useRouter();
  const { result, error, refresh } = useInterview(id ?? null);
  const m = useInterviewMutations();
  const [view, setView] = useState<LiveSession | null>(null);
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [pending, setPending] = useState<InterviewPending | null>(null);
  const [phase, setPhase] = useState<Phase>("answering");
  const [feedback, setFeedback] = useState<{ turnId: string; last: boolean } | null>(null);
  /** the model's feedback on a try that isn't here yet: asked for, or not to be had right now */
  const [waiting, setWaiting] = useState<Record<string, "loading" | "unavailable">>({});
  const [retrying, setRetrying] = useState<string | null>(null);
  /** the question whose answer the interviewer is reading, to see whether it asks more */
  const [reading, setReading] = useState<string | null>(null);
  /** "End interview" was chosen and is on its way: it isn't sent twice, and the buttons stay off until it is back */
  const ending = useRef(false);
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
    setPending(s.pending);
    const open = s.pending != null || s.questions.some((q) => !s.turns.some((t) => t.questionId === q.id));
    setPhase(!open ? "finished" : s.status === "paused" ? "paused" : "answering");
  }, [result, view, router, interview]);

  const next = view?.questions.find((q) => !turns.some((t) => t.questionId === q.id)) ?? null;
  const asked = pending ? view?.questions.find((q) => q.id === pending.questionId) ?? null : null;
  const current = asked ?? (retrying ? view?.questions.find((q) => q.id === retrying) ?? null : next);
  const used = () => Math.round(interview.read());
  const timeLeft = view ? view.minutes * 60 - interview.read() : 0;

  async function finish() {
    if (!view || ending.current) return;
    ending.current = true;
    setBusy(true);
    const r = await m.end(view.id, used()).catch(() => null);
    if (r?.ok) {
      router.push(reportHref(view.id));
      return;
    }
    ending.current = false;
    setFailed(r && !r.ok ? r.message : "The interview didn’t end. Check your connection and try again.");
    setBusy(false);
  }

  /** The model's feedback on a try: asked for once it is whole, and again when the person asks. */
  async function readAnswer(session: LiveSession, turnId: string) {
    setWaiting((w) => ({ ...w, [turnId]: "loading" }));
    const r = await m.feedback(session.id, turnId).catch(() => null);
    if (r?.ok) setTurns((all) => withTurn(all, r.turn));
    setWaiting((w) => {
      const rest = { ...w };
      delete rest[turnId];
      // anything but the feedback itself: the card says it isn't there, and offers to ask again
      return r?.ok && r.ai === "ready" ? rest : { ...rest, [turnId]: "unavailable" };
    });
  }

  /** A question's answers are all in: its feedback, the next question, or the end. */
  async function settle(session: LiveSession, all: LiveTurn[], turn: LiveTurn) {
    setRetrying(null);
    const last = !session.questions.some((q) => !all.some((t) => t.questionId === q.id)) || interview.read() >= session.minutes * 60;
    if (session.feedbackWhen === "each" && turn.answer != null) {
      setFeedback({ turnId: turn.id, last });
      setPhase("feedback");
      if (session.ai && !turn.ai) void readAnswer(session, turn.id);
    } else if (last) {
      await finish();
    } else {
      setPhase("answering");
    }
  }

  async function send() {
    if (!view || !current) return;
    setBusy(true);
    setFailed(null);
    try {
      const seconds = Math.round(answer.read());
      const r = pending
        ? await m.followUpAnswer(view.id, { answer: draft, seconds, secondsUsed: used() })
        : await m.answer(view.id, { questionId: current.id, answer: draft, seconds, secondsUsed: used() });
      if (!r.ok) return setFailed(r.message);
      const all = withTurn(turns, r.turn);
      setTurns(all);
      setDraft("");
      setPending(null);
      answer.reset(0);
      if (r.mayFollowUp && interview.read() < view.minutes * 60) {
        // the answer is saved; the clock stops while the interviewer reads it
        setReading(r.turn.questionId);
        setPhase("thinking");
        const f = await m.askFollowUp(view.id).catch(() => null);
        if (f?.ok && f.followUp) {
          setPending(f.followUp);
          setPhase("answering");
          return;
        }
      }
      await settle(view, all, r.turn);
    } catch {
      setFailed("Your answer didn’t send. Check your connection and try again.");
      setPhase((p) => (p === "thinking" ? "answering" : p));
    } finally {
      setReading(null);
      if (!ending.current) setBusy(false);
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
    if (!view || (!pending && !next)) return;
    setBusy(true);
    setFailed(null);
    try {
      const r = pending
        ? await m.followUpSkip(view.id, { secondsUsed: used() })
        : await m.skip(view.id, { questionId: (next as NonNullable<typeof next>).id, secondsUsed: used() });
      if (!r.ok) return setFailed(r.message);
      const all = withTurn(turns, r.turn);
      setTurns(all);
      setPending(null);
      answer.reset(0);
      await settle(view, all, r.turn);
    } catch {
      setFailed("We couldn’t skip it. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function dismissNote(turnId: string, index: number) {
    if (!view) return;
    setBusy(true);
    setFailed(null);
    const r = await m.dismissNote(view.id, { turnId, index }).catch(() => null);
    if (r?.ok) setTurns((all) => withTurn(all, r.turn));
    else setFailed(r && !r.ok ? r.message : "We couldn’t save that. Check your connection and try again.");
    setBusy(false);
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
  const shown = feedback ? turns.find((t) => t.id === feedback.turnId) : undefined;
  if (phase === "feedback" && feedback && shown) {
    const q = view.questions.find((x) => x.id === shown.questionId);
    const named = new Set(turns.flatMap((t) => t.named));
    const ahead = [...new Set(view.questions
      .filter((x) => x.requirement && !turns.some((t) => t.questionId === x.id))
      .map((x) => x.requirement as string))].filter((r) => !named.has(r));
    const aiState: AiState | undefined = !view.ai ? undefined : shown.ai ? "ready" : waiting[shown.id] ?? "loading";
    return (
      <TrainerFeedback
        session={view}
        n={q ? view.questions.indexOf(q) + 1 : total}
        total={total}
        question={q ?? { text: "", requirement: null }}
        turn={shown}
        aiState={aiState}
        ahead={ahead}
        last={feedback.last}
        canRetry={turns.filter((t) => t.questionId === shown.questionId).length < view.maxTries}
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
          setRetrying(shown.questionId);
          setFeedback(null);
          setDraft("");
          answer.reset(0);
          setPhase("answering");
        }}
        onEnd={() => void finish()}
        onDismissNote={(index) => void dismissNote(shown.id, index)}
        onAskAgain={() => void readAnswer(view, shown.id)}
      />
    );
  }

  // the interview so far, in the order it happened; then the question that waits for its answer
  const transcript: TranscriptLine[] = view.opening ? [{ who: "interviewer", text: view.opening }] : [];
  for (const t of turns) {
    transcript.push({ who: "interviewer", text: view.questions.find((q) => q.id === t.questionId)?.text ?? "" });
    transcript.push({ who: "you", text: t.answer ?? "", skipped: t.answer == null });
    for (const f of t.follow) {
      transcript.push({ who: "interviewer", text: f.question });
      transcript.push({ who: "you", text: f.answer ?? "", skipped: f.answer == null });
    }
  }
  if (pending) transcript.push({ who: "interviewer", text: pending.text });
  else if (current && phase !== "finished" && phase !== "thinking") transcript.push({ who: "interviewer", text: current.text });

  // while the interviewer reads an answer, the count stays on that answer's question
  const about = (reading ? view.questions.find((q) => q.id === reading) : null) ?? current;
  return (
    <TrainerLive
      session={view}
      phase={phase === "feedback" ? "answering" : phase}
      n={about ? view.questions.indexOf(about) + 1 : total}
      total={total}
      question={pending && asked ? { text: pending.text, requirement: asked.requirement } : phase === "thinking" ? null : current}
      followUp={pending != null}
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
