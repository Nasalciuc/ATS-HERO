"use server";
import { db } from "@/db";
import { consumeAiQuotaOn } from "@/lib/ai-quota";

/** Atomic increment-and-check. Returns remaining quota (>=0 means allowed). */
export async function consumeAiQuota(ownerId: string, dailyLimit: number) {
  if (!Number.isInteger(dailyLimit) || dailyLimit <= 0) {
    throw new Error(`consumeAiQuota: invalid dailyLimit=${dailyLimit}`);
  }
  return consumeAiQuotaOn(db, ownerId, dailyLimit);
}
