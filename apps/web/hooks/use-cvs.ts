"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getGuestId } from "@/lib/convexClient";

/**
 * Reactive list of the current user's (or guest's) CVs. Returns `undefined` while
 * loading. Use in a dashboard so the list updates live across tabs/devices.
 */
export function useCvs() {
  return useQuery(api.cvs.listMine, { guestId: getGuestId() });
}

/** Reactive scan history (newest first). `undefined` while loading. */
export function useScans() {
  return useQuery(api.scans.listMine, { guestId: getGuestId() });
}
