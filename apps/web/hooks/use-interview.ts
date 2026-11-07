"use client";
import useSWR, { useSWRConfig } from "swr";
import {
  answerPrepared, answerQuestion, deleteInterview, endInterview, getInterview, getPracticeCounts, getReport, getSetup,
  getTrainerHome, pauseInterview, practiceAgain, skipQuestion, startInterview,
} from "@/app/actions/interview";
import { interviewTrainerEnabled } from "@/lib/features";
import { K } from "@/lib/swr-keys";
import { useCurrentUserId } from "@/hooks/use-current-user-id";

/** The Interview Trainer's pages read through these; nothing is fetched while the switch is off or nobody is signed in. */
function useOn() {
  const userId = useCurrentUserId();
  return { userId, on: interviewTrainerEnabled() && Boolean(userId) };
}

export function useTrainerHome() {
  const { userId, on } = useOn();
  const { data, error, mutate } = useSWR(on ? K.interviewHome(userId) : null, () => getTrainerHome(), { revalidateOnFocus: true });
  return { result: data, error: error as Error | undefined, refresh: () => mutate() };
}

export function useInterviewSetup(jobId: string | null, cvId: string | null) {
  const { userId, on } = useOn();
  const { data, error, mutate } = useSWR(on && jobId ? K.interviewSetup(userId, jobId, cvId ?? "") : null,
    () => getSetup(jobId as string, cvId), { revalidateOnFocus: false });
  return { result: data, error: error as Error | undefined, refresh: () => mutate() };
}

/** The live session: read once; the page keeps its own state from there. */
export function useInterview(id: string | null) {
  const { userId, on } = useOn();
  const { data, error, mutate } = useSWR(on && id ? K.interview(userId, id) : null, () => getInterview(id as string), {
    revalidateOnFocus: false, revalidateOnReconnect: false,
  });
  return { result: data, error: error as Error | undefined, refresh: () => mutate() };
}

export function useInterviewReport(id: string | null) {
  const { userId, on } = useOn();
  const { data, error, mutate } = useSWR(on && id ? K.interviewReport(userId, id) : null, () => getReport(id as string), {
    revalidateOnFocus: false,
  });
  return { result: data, error: error as Error | undefined, refresh: () => mutate() };
}

/** How many times each Tracker job was practised ("Practiced twice"); empty while the switch is off. */
export function usePracticeCounts(): Record<string, number> {
  const { userId, on } = useOn();
  const { data } = useSWR(on ? K.practiceCounts(userId) : null, () => getPracticeCounts());
  return data?.ok ? data.counts : {};
}

export function useInterviewMutations() {
  const { userId } = useOn();
  const { mutate } = useSWRConfig();
  /** what a session changes: the home page, the Tracker's counts, and that session's report */
  const refresh = async (id?: string) => {
    await mutate(K.interviewHome(userId));
    await mutate(K.practiceCounts(userId));
    if (id) await mutate(K.interviewReport(userId, id));
  };
  const after = <A extends [string, ...unknown[]], R>(fn: (...a: A) => Promise<R>) =>
    async (...a: A) => {
      const r = await fn(...a);
      await refresh(a[0]);
      return r;
    };
  return {
    start: async (...a: Parameters<typeof startInterview>) => {
      const r = await startInterview(...a);
      await refresh();
      return r;
    },
    answer: answerQuestion,
    skip: skipQuestion,
    pause: pauseInterview,
    end: after(endInterview),
    prepared: after(answerPrepared),
    remove: after(deleteInterview),
    again: after(practiceAgain),
  };
}
