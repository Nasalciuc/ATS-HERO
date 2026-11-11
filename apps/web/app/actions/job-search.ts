"use server";
/**
 * Daily search (canvas "ATS Hero Tracker v2", page "Search & agent"): read, save and run the
 * person's search. Expected failures come back as `{ ok: false, message }`, not as throws: Next.js
 * hides a thrown message in production, and the screen needs to say what went wrong.
 */
import { z } from "zod";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { jobSearches, type JobSearch } from "@/db/schema";
import { getOwnerId } from "./_shared";
import { withLog } from "@/lib/log";
import { cvOwnershipPredicate } from "@/lib/ownership";
import { jobSearchEnabled } from "@/lib/features";
import { JOB_BOARDS, JOB_COUNTRIES, MAX_PER_DAY, SEARCH_NOW_GAP_MS } from "@/lib/job-search";
import { addedToday, runJobSearch, SearchFailed, type RunSummary } from "@/lib/job-search-run";

type Result<T> = ({ ok: true } & T) | { ok: false; message: string };

const OFF = { ok: false as const, message: "Daily search isn’t available yet." };
const SIGNED_OUT = { ok: false as const, message: "Sign in to use the daily search." };

const serialize = (s: JobSearch) => ({
  id: s.id,
  searchTerm: s.searchTerm,
  country: s.country,
  city: s.city,
  remoteOnly: s.remoteOnly,
  boards: s.boards,
  perDay: s.perDay,
  cvId: s.cvId,
  enabled: s.enabled,
  lastRunAt: s.lastRunAt ? s.lastRunAt.getTime() : null,
  lastFound: s.lastFound,
  lastAdded: s.lastAdded,
  lastError: s.lastError,
});
export type MyJobSearch = ReturnType<typeof serialize>;

const COUNTRY_IDS = JOB_COUNTRIES.map((c) => c.id) as [string, ...string[]];

const SearchInput = z.object({
  searchTerm: z.string().trim().min(2).max(100),
  country: z.enum(COUNTRY_IDS),
  // with the country, the place apps/ai gets stays within its 100 characters
  city: z.string().trim().max(60).optional(),
  remoteOnly: z.boolean().default(false),
  boards: z.array(z.enum(JOB_BOARDS as [string, ...string[]])).min(1).max(JOB_BOARDS.length),
  perDay: z.number().int().min(1).max(MAX_PER_DAY),
  cvId: z.string().max(64).nullable().optional(),
  enabled: z.boolean().default(true),
});
export type JobSearchInput = z.input<typeof SearchInput>;

/** The person's search, or null when they have none. */
export async function getMyJobSearch(): Promise<MyJobSearch | null> {
  if (!jobSearchEnabled()) return null;
  const ownerId = await getOwnerId();
  if (!ownerId) return null;
  const row = await withLog("jobSearch.get", { ownerId }, () => db.query.jobSearches.findFirst({ where: eq(jobSearches.ownerId, ownerId) }));
  return row ? serialize(row) : null;
}

/** Creates or changes the person's one search. The CV, if named, must be theirs. */
export async function saveJobSearch(input: JobSearchInput): Promise<Result<{ search: MyJobSearch }>> {
  if (!jobSearchEnabled()) return OFF;
  const ownerId = await getOwnerId();
  if (!ownerId) return SIGNED_OUT;
  const parsed = SearchInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Check the job title (2–100 characters), the country and at least one place to look." };
  const v = parsed.data;
  const values = {
    searchTerm: v.searchTerm,
    country: v.country,
    city: v.city || null,
    remoteOnly: v.remoteOnly,
    boards: [...new Set(v.boards)] as JobSearch["boards"],
    perDay: v.perDay,
    cvId: v.cvId ?? null,
    enabled: v.enabled,
  };
  const row = await withLog("jobSearch.save", { ownerId }, async () => {
    // a CV that isn't theirs: nothing is saved
    if (v.cvId && !(await db.query.cvs.findFirst({ where: cvOwnershipPredicate(v.cvId, ownerId) }))) return null;
    const [saved] = await db.insert(jobSearches).values({ ownerId, ...values })
      .onConflictDoUpdate({ target: jobSearches.ownerId, set: values })
      .returning();
    return saved;
  });
  if (!row) return { ok: false, message: "Choose one of your CVs." };
  return { ok: true, search: serialize(row) };
}

/** "Search now": runs the person's search at once, at most every few minutes. */
export async function runMyJobSearchNow(): Promise<Result<{ summary: RunSummary; search: MyJobSearch }>> {
  if (!jobSearchEnabled()) return OFF;
  const ownerId = await getOwnerId();
  if (!ownerId) return SIGNED_OUT;
  // one search per person (job_searches_by_owner): the owner names the row
  const mine = eq(jobSearches.ownerId, ownerId);
  const now = new Date();
  const claim = await withLog("jobSearch.claim", { ownerId }, async (): Promise<{ search: JobSearch } | { message: string }> => {
    const search = await db.query.jobSearches.findFirst({ where: mine });
    if (!search) return { message: "Save the search first." };
    if (await addedToday(ownerId, now) >= search.perDay) {
      const n = search.perDay;
      return { message: `Saved already has today’s ${n} new ${n === 1 ? "job" : "jobs"} from the search. The next search runs tomorrow morning.` };
    }
    // the claim: one "Search now" passes in the gap, even when pressed twice at once
    const [claimed] = await db.update(jobSearches).set({ lastRunAt: now })
      .where(and(mine, or(isNull(jobSearches.lastRunAt), lt(jobSearches.lastRunAt, new Date(now.getTime() - SEARCH_NOW_GAP_MS)))))
      .returning();
    return claimed ? { search: claimed } : { message: "You searched a moment ago. Try again in a few minutes." };
  });
  if ("message" in claim) return { ok: false, message: claim.message };
  try {
    const summary = await runJobSearch(claim.search, { now });
    const after = await withLog("jobSearch.get", { ownerId }, () => db.query.jobSearches.findFirst({ where: mine }));
    return { ok: true, summary, search: serialize(after ?? claim.search) };
  } catch (e) {
    if (e instanceof SearchFailed) return { ok: false, message: e.message };
    return { ok: false, message: "The search failed. Try again later." };
  }
}
