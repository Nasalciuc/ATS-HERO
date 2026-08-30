"use server";
import { auth } from "@clerk/nextjs/server";

export async function getOwnerId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

type Ownable = { ownerId: string | null; guestId: string | null };

/** Owned docs: only the signed-in owner. Guest docs: only the matching guestId. */
export async function canRead(doc: Ownable, guestId?: string): Promise<boolean> {
  const ownerId = await getOwnerId();
  if (doc.ownerId) return ownerId === doc.ownerId;
  if (doc.guestId) return !!guestId && guestId === doc.guestId;
  return false;
}
export async function assertCanWrite(doc: Ownable, guestId?: string): Promise<void> {
  if (!(await canRead(doc, guestId))) throw new Error("Forbidden");
}
