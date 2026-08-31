"use client";
import useSWR from "swr";
import { useAuth } from "@clerk/nextjs";
import { listMyScans } from "@/app/actions/scans";
import { getGuestId } from "@/lib/guest";
import { K } from "@/lib/swr-keys";

/** Scan history (newest first). `undefined` while loading. */
export function useScans() {
  const { userId } = useAuth();
  const guestId = getGuestId();
  const { data } = useSWR(K.scans(userId, guestId), () => listMyScans(guestId),
    { revalidateOnFocus: true });
  return data;
}
