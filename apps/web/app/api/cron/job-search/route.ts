import { NextResponse } from "next/server";
import { jobSearchEnabled } from "@/lib/features";
import { CRON_SEARCH_GAP_MS } from "@/lib/job-search";
import { dueSearches, runJobSearch } from "@/lib/job-search-run";

export const runtime = "nodejs";
/** Searches one after another, one every CRON_SEARCH_GAP_MS at most; apps/ai takes up to ~25 s each. */
export const maxDuration = 300;

/** At most this many searches per call, so a run ends well inside the function's time. */
const PER_CALL = 8;

/**
 * The daily search's morning run (vercel.json). Searches that are on and haven't run today, the
 * oldest run first, one at a time and no faster than apps/ai takes them. A search that fails is
 * recorded on itself and the rest go on.
 * Beyond PER_CALL a day, the background worker from JOB-SEARCH-DESIGN.md F2 takes over.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({}, { status: 401 });
  if (!jobSearchEnabled()) return NextResponse.json({ disabled: true });

  const now = new Date();
  const due = await dueSearches(now, PER_CALL);
  let added = 0;
  let failed = 0;
  let started = 0;
  for (const search of due) {
    const wait = started + CRON_SEARCH_GAP_MS - Date.now();
    if (started && wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    started = Date.now();
    try {
      added += (await runJobSearch(search, { now })).added;
    } catch {
      failed++; // recorded on the search by runJobSearch
    }
  }
  return NextResponse.json({ searches: due.length, added, failed });
}
