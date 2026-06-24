import type { QueryCtx, MutationCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

/** The signed-in Clerk subject, or null for guests. */
export async function getOwnerId(ctx: Ctx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

type Ownable = { ownerId?: string; guestId?: string };

/**
 * Can the caller read this document?
 * - Owned docs: only the signed-in owner.
 * - Guest docs: only a caller presenting the matching guestId.
 */
export async function canRead(ctx: Ctx, doc: Ownable, guestId?: string): Promise<boolean> {
  const ownerId = await getOwnerId(ctx);
  if (doc.ownerId) return ownerId === doc.ownerId;
  if (doc.guestId) return !!guestId && guestId === doc.guestId;
  return false;
}

/** Throws unless the caller may write this document. */
export async function assertCanWrite(ctx: Ctx, doc: Ownable, guestId?: string): Promise<void> {
  if (!(await canRead(ctx, doc, guestId))) throw new Error("Forbidden");
}
