"use client";
import useSWR, { useSWRConfig } from "swr";
import { getMyJobSearch, runMyJobSearchNow, saveJobSearch, type JobSearchInput } from "@/app/actions/job-search";
import { jobSearchEnabled } from "@/lib/features";
import { K } from "@/lib/swr-keys";
import { useCurrentUserId } from "@/hooks/use-current-user-id";

/** The person's daily search: undefined while loading, null when they have none (or it's switched off). */
export function useJobSearch() {
  const userId = useCurrentUserId();
  const on = jobSearchEnabled() && Boolean(userId);
  const { data, mutate } = useSWR(on ? K.jobSearch(userId) : null, () => getMyJobSearch());
  return { search: on ? data : null, refresh: () => mutate() };
}

export function useJobSearchMutations() {
  const userId = useCurrentUserId();
  const { mutate } = useSWRConfig();
  const refresh = async () => {
    await mutate(K.jobSearch(userId));
    await mutate(K.apps(userId));
  };
  return {
    save: async (input: JobSearchInput) => {
      const r = await saveJobSearch(input);
      if (r.ok) await refresh();
      return r;
    },
    runNow: async () => {
      const r = await runMyJobSearchNow();
      await refresh();
      return r;
    },
  };
}
