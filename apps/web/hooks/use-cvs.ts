"use client";
import useSWR, { useSWRConfig } from "swr";
import { listMyCvs, createCv, updateCv, removeCv, claimGuest } from "@/app/actions/cvs";
import { getGuestId } from "@/lib/guest";
import { K } from "@/lib/swr-keys";

/**
 * List of the current user's (or guest's) CVs. `undefined` while loading — same contract the
 * reactive Convex query had, so consumers are unchanged.
 */
export function useCvs() {
  const guestId = getGuestId();
  const { data } = useSWR(K.cvs(guestId), () => listMyCvs(guestId),
    { revalidateOnFocus: true });
  return data;
}

export function useCvMutations() {
  const { mutate } = useSWRConfig();
  const guestId = getGuestId();
  const refresh = () => mutate(K.cvs(guestId));
  return {
    create: async (i: Omit<Parameters<typeof createCv>[0], "guestId">) => { const r = await createCv({ ...i, guestId }); await refresh(); return r; },
    update: async (id: string, p: Parameters<typeof updateCv>[1]) => { const r = await updateCv(id, p, guestId); await refresh(); return r; },
    remove: async (id: string) => { const r = await removeCv(id, guestId); await refresh(); return r; },
    claim:  async () => { const r = await claimGuest(guestId); await refresh(); return r; },
  };
}
