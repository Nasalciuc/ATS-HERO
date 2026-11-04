import { NextResponse } from "next/server";
import { jobSearchEnabled } from "@/lib/features";
import { dueSearches, runJobSearch } from "@/lib/job-search-run";

export const runtime = "nodejs";
/** Searches one after another; apps/ai takes up to ~25 s each. */
export const maxDuration = 300;

/** At most this many searches per call, so a run ends well inside the function's time. */
const PER_CALL = 8;

/**
 * The daily search's morning run (vercel.json). Searches that are on and haven't run today, the
 * oldest run first, one at a time. A search that fails is recorded on itself and the rest go on.
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
  for (const search of due) {
    try {
      added += (await runJobSearch(search, { now })).added;
    } catch {
      failed++; // recorded on the search by runJobSearch
    }
  }
  return NextResponse.json({ searches: due.length, added, failed });
}
