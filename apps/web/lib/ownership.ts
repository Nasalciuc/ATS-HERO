import { and, eq } from "drizzle-orm";
import { cvs } from "@/db/schema";

/** Pure ownership check — same rules as `canRead`, without Clerk. */
export function canAccessDoc(
  doc: { ownerId: string | null; guestId: string | null },
  ownerId: string | null,
  guestId?: string,
): boolean {
  if (doc.ownerId) return ownerId === doc.ownerId;
  if (doc.guestId) return !!guestId && guestId === doc.guestId;
  return false;
}

/** Atomic write predicate: ownership is part of the UPDATE/DELETE WHERE. */
export function cvOwnershipPredicate(id: string, ownerId: string | null, guestId?: string) {
  return ownerId
    ? and(eq(cvs.id, id), eq(cvs.ownerId, ownerId))
    : and(eq(cvs.id, id), eq(cvs.guestId, guestId ?? "__none__"));
}

