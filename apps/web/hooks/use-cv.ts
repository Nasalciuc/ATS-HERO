"use client";
import useSWR from "swr";
import { getCvById } from "@/app/actions/cvs";
import { getGuestId } from "@/lib/guest";
import { K } from "@/lib/swr-keys";

/**
 * Read of ONE CV by id (owner- or guest-scoped). `undefined` while loading, `null` if not found /
 * forbidden. Use for read-only views (preview, share). The editable copy in the builder is owned by
 * AppContext — do not drive the editor from this hook.
 */
export function useCv(id: string | null | undefined) {
  const guestId = getGuestId();
  const { data } = useSWR(id ? K.cv(id) : null, () => getCvById(id!, guestId));
  return data;
}
