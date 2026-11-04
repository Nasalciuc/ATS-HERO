"use client";
import useSWR, { useSWRConfig } from "swr";
import {
  addToQueue, cancelQueued, getMyQueue, getReview, prepareQueued, removeFromQueue, sendQueued, setMyDailyLimit,
} from "@/app/actions/apply-queue";
import { applyAgentEnabled } from "@/lib/features";
import { K } from "@/lib/swr-keys";
import { useCurrentUserId } from "@/hooks/use-current-user-id";

/** "Ready to send": the queue, today's count and limit, and the Saved jobs the agent can do. */
export function useApplyQueue() {
  const userId = useCurrentUserId();
  const on = applyAgentEnabled() && Boolean(userId);
  const { data, error, mutate } = useSWR(on ? K.applyQueue(userId) : null, () => getMyQueue(), { revalidateOnFocus: true });
  return { result: data, error: error as Error | undefined, refresh: () => mutate() };
}

/** The filled form to check: null when it closed. */
export function useReview(id: string | null) {
  const userId = useCurrentUserId();
  const on = applyAgentEnabled() && Boolean(userId) && Boolean(id);
  const { data, mutate } = useSWR(on ? K.applyReview(userId, id as string) : null, () => getReview(id as string), {
    revalidateOnFocus: false,
  });
  return { result: data, refresh: () => mutate() };
}

export function useApplyQueueMutations() {
  const userId = useCurrentUserId();
  const { mutate } = useSWRConfig();
  const refresh = async () => {
    await mutate(K.applyQueue(userId));
    await mutate(K.apps(userId));
  };
  const after = <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
    async (...a: A) => {
      const r = await fn(...a);
      await refresh();
      return r;
    };
  return {
    add: after(addToQueue),
    remove: after(removeFromQueue),
    setLimit: after(setMyDailyLimit),
    prepare: after(prepareQueued),
    send: after(sendQueued),
    cancel: after(cancelQueued),
  };
}
