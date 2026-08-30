"use client";
import useSWR from "swr";
import { listMyScans } from "@/app/actions/scans";
import { getGuestId } from "@/lib/guest";
import { K } from "@/lib/swr-keys";

/** Scan history (newest first). `undefined` while loading. */
export function useScans() {
  const guestId = getGuestId();
  const { data } = useSWR(K.scans(guestId), () => listMyScans(guestId),
    { revalidateOnFocus: true });
  return data;
}
