import { ConvexReactClient } from "convex/react";
import { nanoid } from "nanoid";

/**
 * ONE ConvexReactClient for the whole app. It is passed to ConvexProviderWithClerk
 * (which attaches the Clerk auth token to it), so imperative calls made here —
 * `convex.mutation(...)` / `convex.query(...)` from lib/api.ts — are authenticated
 * exactly like the hook-based calls. Do NOT create a second client.
 */
export const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL ?? "");

const GUEST_ID_KEY = "ats_hero_guest_id";

/** Stable per-browser guest id (nanoid), created lazily on first use. */
export function getGuestId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = nanoid();
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}
