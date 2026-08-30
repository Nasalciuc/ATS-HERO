"use server";
import { db } from "@/db";
import { users, cvs, scans, aiUsage, applications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { withLog } from "@/lib/log";

export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;
  return (await db.query.users.findFirst({ where: eq(users.clerkId, userId) })) ?? null;
}

export async function upsertCurrentUser(input: { email: string; name?: string }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  return withLog("users.upsert", { userId }, async () => {
    // Callers may fire before Clerk's client-side user is hydrated; the identity on the
    // server is always available, so never persist an empty email.
    let { email, name } = input;
    if (!email) {
      const cu = await currentUser();
      email = cu?.primaryEmailAddress?.emailAddress ?? "";
      name = name ?? cu?.fullName ?? undefined;
    }
    const [row] = await db.insert(users)
      .values({ clerkId: userId, email, name })
      .onConflictDoUpdate({ target: users.clerkId, set: { email, name } })
      .returning();
    return row;
  });
}

/** P0 #6 — GDPR. Cascade across all owned data, then the user row. */
export async function deleteAccount() {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  return withLog("users.deleteAccount", { userId }, async () => {
    await db.transaction(async (tx) => {
      await tx.delete(applications).where(eq(applications.ownerId, userId));
      await tx.delete(scans).where(eq(scans.ownerId, userId));
      await tx.delete(cvs).where(eq(cvs.ownerId, userId));
      await tx.delete(aiUsage).where(eq(aiUsage.ownerId, userId));
      await tx.delete(users).where(eq(users.clerkId, userId));
    });
    return { ok: true };
  });
}
