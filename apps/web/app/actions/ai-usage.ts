"use server";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import { sql } from "drizzle-orm";

/** Atomic increment-and-check. Returns remaining quota (>=0 means allowed). */
export async function consumeAiQuota(ownerId: string, dailyLimit: number) {
  const day = new Date().toISOString().slice(0, 10);
  const [row] = await db.insert(aiUsage)
    .values({ ownerId, day, count: 1 })
    .onConflictDoUpdate({ target: [aiUsage.ownerId, aiUsage.day],
      set: { count: sql`${aiUsage.count} + 1` } })
    .returning({ count: aiUsage.count });
  return dailyLimit - row.count;
}
