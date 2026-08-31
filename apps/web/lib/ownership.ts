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
