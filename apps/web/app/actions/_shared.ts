"use server";
import { auth } from "@clerk/nextjs/server";
import { canAccessDoc } from "@/lib/ownership";
import { isClerkConfigured } from "@/lib/clerk-config";

export async function getOwnerId(): Promise<string | null> {
  // Without Clerk keys proxy.ts does not mount clerkMiddleware(), and auth() throws
  // ("auth() was called but Clerk can't detect usage of clerkMiddleware()"). That made every
  // Server Action 500 in guest-only runs (local dev, CI E2E, keyless previews), so no CV could
  // ever be saved. No Clerk configured ⇒ nobody can be signed in ⇒ guest. Production (keys set)
  // takes the normal path below.
  if (!isClerkConfigured()) return null;
  const { userId } = await auth();
  return userId ?? null;
}

type Ownable = { ownerId: string | null; guestId: string | null };

/** Owned docs: only the signed-in owner. Guest docs: only the matching guestId. */
export async function canRead(doc: Ownable, guestId?: string): Promise<boolean> {
  return canAccessDoc(doc, await getOwnerId(), guestId);
}
export async function assertCanWrite(doc: Ownable, guestId?: string): Promise<void> {
  if (!(await canRead(doc, guestId))) throw new Error("Forbidden");
}
