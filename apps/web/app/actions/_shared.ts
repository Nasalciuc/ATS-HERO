"use server";
import { auth } from "@clerk/nextjs/server";
import { canAccessDoc } from "@/lib/ownership";

export async function getOwnerId(): Promise<string | null> {
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
