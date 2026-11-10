/**
 * Interview Trainer: how many model runs a day (ANTRENOR-INTERVIU-VOCE.md §7: a daily ceiling for
 * everybody, in ai_usage, next to the kill-switch). A run is one follow-up decision or one feedback:
 * at most two calls to the model (model.ts).
 *
 * Two counters in ai_usage per UTC day, apart from the rewrite's own (which is the bare owner id):
 * - "interview:<owner>": one person's runs;
 * - "interview:*": everybody's.
 * A run counts before it is made, and a run over either limit isn't made: the trainer goes on
 * without the model for that answer. A run that fails still counts: the limit is on what we ask a
 * provider for, not on what came back.
 *
 * A session is already bounded (20 a month, 4 or 8 questions, 3 tries, 1 to 3 follow-ups); these two
 * are the ceiling on the bill if something loops, here or in a browser.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import { consumeAiQuotaOn } from "@/lib/ai-quota";
import { positiveIntEnv } from "@/lib/env";

/** One person, one day: several long sessions with the Tough interviewer, which asks the most. */
export const RUNS_PER_DAY = 200;
/** Everybody together, one day: the ceiling on a day's bill. Set it from the price of the model in use. */
export const RUNS_PER_DAY_ALL = 5000;

const PREFIX = "interview:";
export const usageKey = (ownerId: string) => `${PREFIX}${ownerId}`;
export const ALL_USAGE_KEY = `${PREFIX}*`;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Counts one run for the owner and, if they are within their day's limit, for everybody. True when
 * the run may be made. The person's own limit comes first, so one person over theirs can't use up
 * everybody's.
 */
export async function spendRun(ownerId: string): Promise<boolean> {
  const mine = await consumeAiQuotaOn(db, usageKey(ownerId), positiveIntEnv("AI_INTERVIEW_DAILY_LIMIT", RUNS_PER_DAY));
  if (mine < 0) return false;
  const all = await consumeAiQuotaOn(db, ALL_USAGE_KEY, positiveIntEnv("AI_INTERVIEW_GLOBAL_DAILY_LIMIT", RUNS_PER_DAY_ALL));
  return all >= 0;
}

/** The owner's counter goes with the account, inside the caller's transaction. Everybody's stays: it names nobody. */
export async function removeInterviewUsage(tx: Tx, ownerId: string): Promise<void> {
  await tx.delete(aiUsage).where(eq(aiUsage.ownerId, usageKey(ownerId)));
}
