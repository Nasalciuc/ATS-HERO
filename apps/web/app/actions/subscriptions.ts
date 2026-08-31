"use server";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

/** The signed-in user's subscription row, or null. Read-only; webhooks own the writes. */
export async function getMySubscription() {
  const { userId } = await auth();
  if (!userId) return null;
  const row = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.ownerId, userId),
  });
  if (!row) return null;
  return {
    status: row.status,
    kind: row.kind,
    currentPeriodEnd: row.currentPeriodEnd ? row.currentPeriodEnd.getTime() : null,
  };
}
