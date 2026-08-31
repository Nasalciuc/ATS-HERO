import { aiUsage } from "@/db/schema";
import { sql } from "drizzle-orm";

/** Shared by the server action and PGlite tests. Fail closed on a bad limit. */
export function assertValidDailyLimit(dailyLimit: number): void {
  if (!Number.isInteger(dailyLimit) || dailyLimit <= 0) {
    throw new Error(`consumeAiQuota: invalid dailyLimit=${dailyLimit}`);
  }
}

/** Atomic increment-and-check. Returns remaining quota (>=0 means allowed). */
export async function consumeAiQuotaOn(
  // drizzle insert API is shared across node-postgres and PGlite
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  ownerId: string,
  dailyLimit: number,
): Promise<number> {
  assertValidDailyLimit(dailyLimit);
  const day = new Date().toISOString().slice(0, 10);
  const [row] = await db.insert(aiUsage)
    .values({ ownerId, day, count: 1 })
    .onConflictDoUpdate({
      target: [aiUsage.ownerId, aiUsage.day],
      set: { count: sql`${aiUsage.count} + 1` },
    })
    .returning({ count: aiUsage.count });
  return dailyLimit - row.count;
}
