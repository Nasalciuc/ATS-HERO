/**
 * Daily search, the run: ask apps/ai's POST /jobs/search, keep the best new postings, put them in
 * Saved. Server code only (the Server Actions and /api/cron/job-search call it); the rules it
 * applies are in `lib/job-search.ts`.
 *
 * What leaves us: the title and the place, to apps/ai and from there to the boards. The CV never
 * does: Job Fit runs here, on our side. The run writes nothing about the posts it left out.
 */
import { and, desc, eq, gte, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { applicationEvents, applications, cvs, jobSearches, type JobSearch } from "@/db/schema";
import { withLog } from "./log";
import { BOARD_LABEL, boardsFor, pickPostings, searchRequest, type Posting } from "./job-search";
import { platformOf } from "./tracker";
import { cvToText, type CvData, type JobBoard } from "./types";

/** apps/ai, seen from our server. AI_URL is server-only; the browser's NEXT_PUBLIC_AI_URL is the fallback. */
export const aiUrl = () => process.env.AI_URL ?? process.env.NEXT_PUBLIC_AI_URL ?? "http://localhost:8000";
/** apps/ai stops a search at 25 s; the answer and its JSON get a little more. */
export const SEARCH_TIMEOUT_MS = 40_000;

export interface RunDeps {
  fetch?: typeof fetch;
  aiUrl?: string;
  now?: Date;
}

export interface RunSummary {
  found: number;
  added: number;
  /** already in the tracker */
  repeats: number;
  /** the boards that failed, by name ("LinkedIn"); nothing they said is kept */
  failed: string[];
}

export class SearchFailed extends Error {}

interface SearchAnswer {
  jobs?: Posting[];
  errors?: Record<string, string>;
}

/** The search's CV: the one it names if it is still the owner's, else the one changed last. */
async function cvTextFor(search: JobSearch): Promise<string | null> {
  const mine = eq(cvs.ownerId, search.ownerId);
  const row = (search.cvId
    ? await db.query.cvs.findFirst({ where: and(mine, eq(cvs.id, search.cvId)) })
    : undefined) ?? await db.query.cvs.findFirst({ where: mine, orderBy: [desc(cvs.updatedAt)] });
  return row ? cvToText(row.data as CvData) : null;
}

async function askBoards(search: JobSearch, deps: RunDeps): Promise<SearchAnswer> {
  const doFetch = deps.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`${deps.aiUrl ?? aiUrl()}/jobs/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(searchRequest(search)),
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
  } catch {
    throw new SearchFailed("The job search service didn’t answer. Try again later.");
  }
  if (res.status === 429) throw new SearchFailed("Too many searches just now. Try again in a minute.");
  if (res.status === 422) throw new SearchFailed("The boards didn’t accept this title or place. Change them and try again.");
  if (!res.ok) throw new SearchFailed("The boards didn’t answer. We’ll try again tomorrow.");
  return (await res.json()) as SearchAnswer;
}

/** The UTC day's start: the day "up to N a day" counts, as the morning run does. */
const dayStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/** Jobs the daily search put in this person's Saved today, by any run. */
export async function addedToday(ownerId: string, now: Date): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(applications).where(and(
    eq(applications.ownerId, ownerId), eq(applications.source, "job_search"), gte(applications.appliedAt, dayStart(now)),
  ));
  return r?.n ?? 0;
}

/**
 * Runs one search now and records how it went on the search. New postings go to Saved, each with
 * its first history line, never more in a day than the search's `perDay`; a link already in the
 * tracker is left alone (the unique index catches two runs at once). A failure is recorded, then
 * thrown for the caller to show.
 */
export async function runJobSearch(search: JobSearch, deps: RunDeps = {}): Promise<RunSummary> {
  const now = deps.now ?? new Date();
  const ownerId = search.ownerId;
  return withLog("jobSearch.run", { ownerId, searchId: search.id }, async () => {
    // today's jobs are already in Saved: the boards aren't asked
    const room = Math.max(0, search.perDay - await addedToday(ownerId, now));
    if (room === 0) return { found: 0, added: 0, repeats: 0, failed: [] };

    if (boardsFor(search).length === 0) {
      await db.update(jobSearches).set({ lastRunAt: now, lastFound: 0, lastAdded: 0, lastError: "No board can search this country." })
        .where(eq(jobSearches.id, search.id));
      throw new SearchFailed("No board can search this country. Choose LinkedIn, or another country.");
    }

    let answer: SearchAnswer;
    try {
      answer = await askBoards(search, deps);
    } catch (e) {
      const message = e instanceof SearchFailed ? e.message : "The search failed.";
      await db.update(jobSearches).set({ lastRunAt: now, lastFound: 0, lastAdded: 0, lastError: message })
        .where(eq(jobSearches.id, search.id));
      throw e instanceof SearchFailed ? e : new SearchFailed(message);
    }

    const [cvText, existing] = await Promise.all([
      cvTextFor(search),
      db.select({ key: applications.urlKey }).from(applications)
        .where(and(eq(applications.ownerId, ownerId), isNotNull(applications.urlKey))),
    ]);
    const { picked, found, repeats } = pickPostings(answer.jobs ?? [], {
      existingKeys: new Set(existing.map((r) => r.key as string)),
      cvText,
      perDay: room,
      today: now,
    });

    const added = await db.transaction(async (tx) => {
      let n = 0;
      for (const p of picked) {
        const [row] = await tx.insert(applications).values({
          ownerId,
          company: p.company,
          role: p.role,
          url: p.url,
          urlKey: p.urlKey,
          location: p.location,
          description: p.description,
          status: "saved",
          source: "job_search",
          platform: platformOf(p.url),
          appliedAt: now,
          submittedAt: null,
        }).onConflictDoNothing().returning({ id: applications.id });
        if (!row) continue;
        await tx.insert(applicationEvents).values({ applicationId: row.id, ownerId, kind: "created", toStatus: "saved", at: now });
        n++;
      }
      return n;
    });

    const failed = Object.keys(answer.errors ?? {})
      .filter((b): b is JobBoard => b in BOARD_LABEL)
      .map((b) => BOARD_LABEL[b]);
    const lastError = failed.length && found === 0 ? `${failed.join(" and ")} didn’t answer.` : null;
    await db.update(jobSearches).set({ lastRunAt: now, lastFound: found, lastAdded: added, lastError })
      .where(eq(jobSearches.id, search.id));
    return { found, added, repeats, failed };
  });
}

/** Searches due today: on, and not run since this UTC day began. The oldest run first. */
export async function dueSearches(now: Date, limit: number): Promise<JobSearch[]> {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return db.select().from(jobSearches)
    .where(and(eq(jobSearches.enabled, true), or(isNull(jobSearches.lastRunAt), lt(jobSearches.lastRunAt, dayStart))))
    // never run first: Postgres puts nulls last in an ascending order
    .orderBy(sql`${jobSearches.lastRunAt} asc nulls first`)
    .limit(limit);
}
