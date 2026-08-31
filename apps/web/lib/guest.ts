import { nanoid } from "nanoid";

/**
 * Stable per-browser guest id, created lazily on first use. Same key and semantics the
 * Convex client used, so an existing guest keeps their CVs across the Postgres migration.
 */
const GUEST_ID_KEY = "ats_hero_guest_id";

export function getGuestId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = nanoid();
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}
