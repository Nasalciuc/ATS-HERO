"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getGuestId } from "@/lib/convexClient";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Reactive read of ONE CV by id (owner- or guest-scoped). Returns `undefined` while loading and
 * `null` if not found / forbidden. Use for read-only views (preview, share). The editable copy in
 * the builder is owned by AppContext — do not drive the editor from this hook (a live query must
 * never overwrite in-progress edits).
 */
export function useCv(id: string | null | undefined) {
  return useQuery(
    api.cvs.getById,
    id ? { id: id as Id<"cvs">, guestId: getGuestId() } : "skip"
  );
}
