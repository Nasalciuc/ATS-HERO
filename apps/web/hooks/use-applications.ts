"use client";
import useSWR, { useSWRConfig } from "swr";
import {
  answerFollowUp, archiveApplication, createApplication, listApplicationEvents, listMyApplications,
  removeApplication, setCvSent, unarchiveApplication, updateApplicationDetails, updateStatus,
} from "@/app/actions/applications";
import { K } from "@/lib/swr-keys";
import { useCurrentUserId } from "@/hooks/use-current-user-id";

/**
 * The owner's jobs. `data` is undefined while loading; `error` is set when the server could not
 * answer (the page shows it instead of "Loading…" forever).
 */
export function useApplications() {
  const userId = useCurrentUserId();
  const { data, error, mutate } = useSWR(K.apps(userId), () => listMyApplications(), { revalidateOnFocus: true });
  return { jobs: data, error: error as Error | undefined, retry: () => mutate() };
}

export function useApplicationEvents(id: string | null) {
  const userId = useCurrentUserId();
  const { data } = useSWR(id ? K.appEvents(userId, id) : null, () => listApplicationEvents(id as string));
  return data;
}

export function useApplicationMutations() {
  const userId = useCurrentUserId();
  const { mutate } = useSWRConfig();
  const refresh = async (id?: string) => {
    await mutate(K.apps(userId));
    if (id) await mutate(K.appEvents(userId, id));
  };
  const after = <A extends unknown[], R extends { id: string }>(fn: (...a: A) => Promise<R>) =>
    async (...a: A) => {
      const r = await fn(...a);
      await refresh(r.id);
      return r;
    };
  return {
    create: after(createApplication),
    updateStatus: after(updateStatus),
    updateDetails: after(updateApplicationDetails),
    archive: after(archiveApplication),
    unarchive: after(unarchiveApplication),
    followUp: after(answerFollowUp),
    setCvSent: after(setCvSent),
    remove: async (id: string) => {
      const r = await removeApplication(id);
      await refresh();
      return r;
    },
  };
}
