"use client";
import useSWR from "swr";
import { listMyScans } from "@/app/actions/scans";
import { getGuestId } from "@/lib/guest";
import { K } from "@/lib/swr-keys";
import { useCurrentUserId } from "@/hooks/use-current-user-id";

/** Scan history (newest first). `undefined` while loading. */
export function useScans() {
  const userId = useCurrentUserId();
  const guestId = getGuestId();
  const { data } = useSWR(K.scans(userId, guestId), () => listMyScans(guestId),
    { revalidateOnFocus: true });
  return data;
}
