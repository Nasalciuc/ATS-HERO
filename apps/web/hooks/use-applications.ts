"use client";
import useSWR, { useSWRConfig } from "swr";
import { listMyApplications, createApplication, updateStatus, removeApplication } from "@/app/actions/applications";
import { K } from "@/lib/swr-keys";

export function useApplications() {
  const { data } = useSWR(K.apps(), () => listMyApplications(), { revalidateOnFocus: true });
  return data;
}

export function useApplicationMutations() {
  const { mutate } = useSWRConfig();
  const refresh = () => mutate(K.apps());
  return {
    create: async (i: Parameters<typeof createApplication>[0]) => {
      const r = await createApplication(i);
      await refresh();
      return r;
    },
    updateStatus: async (id: string, status: Parameters<typeof updateStatus>[1]) => {
      const r = await updateStatus(id, status);
      await refresh();
      return r;
    },
    remove: async (id: string) => {
      const r = await removeApplication(id);
      await refresh();
      return r;
    },
  };
}
