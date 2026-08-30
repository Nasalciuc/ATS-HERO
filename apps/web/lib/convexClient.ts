import { ConvexReactClient } from "convex/react";

/**
 * ONE ConvexReactClient for the whole app. It is passed to ConvexProviderWithClerk
 * (which attaches the Clerk auth token to it), so imperative calls made here —
 * `convex.mutation(...)` / `convex.query(...)` from lib/api.ts — are authenticated
 * exactly like the hook-based calls. Do NOT create a second client.
 *
 * The placeholder keeps the constructor from throwing during prerender when
 * NEXT_PUBLIC_CONVEX_URL is not set (e.g. Vercel before Convex is provisioned).
 * Tier 0/1 (builder + client-side scoring) works; persistence stays offline.
 */
const CONVEX_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL || "https://convex-url-not-set.invalid";

export const convex = new ConvexReactClient(CONVEX_URL);

// getGuestId now lives in lib/guest.ts (survives the Convex teardown). Re-exported so the
// existing Convex call sites keep working unchanged until this file is deleted.
export { getGuestId } from "./guest";
