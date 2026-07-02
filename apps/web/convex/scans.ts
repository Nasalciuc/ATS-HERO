// Flat module on purpose — client calls api.scans.* ("scans:*" paths). See cvs.ts.
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { scanKindValidator } from "./_shared/validators";
import { getOwnerId, canRead } from "./_shared/utils";

/** Scans for the signed-in user, or (for guests) by the given guestId, newest first. */
export const listMine = query({
  args: { guestId: v.optional(v.string()) },
  handler: async (ctx, { guestId }) => {
    const identity = await ctx.auth.getUserIdentity();
    const rows = identity
      ? await ctx.db
          .query("scans")
          .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
          .collect()
      : guestId
        ? await ctx.db
            .query("scans")
            .withIndex("by_guest", (q) => q.eq("guestId", guestId))
            .collect()
        : [];
    return rows.sort((a, b) => b._creationTime - a._creationTime);
  },
});

export const getById = query({
  args: { id: v.id("scans"), guestId: v.optional(v.string()) },
  handler: async (ctx, { id, guestId }) => {
    const scan = await ctx.db.get(id);
    if (!scan) return null;
    return (await canRead(ctx, scan, guestId)) ? scan : null;
  },
});

/** Persists a score / job-fit result for the signed-in user or guest. */
export const save = mutation({
  args: {
    kind: scanKindValidator,
    engine: v.optional(v.string()),
    generalScore: v.number(),
    result: v.any(),
    cvId: v.optional(v.id("cvs")),
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, { kind, engine, generalScore, result, cvId, guestId }) => {
    const ownerId = await getOwnerId(ctx);
    const id = await ctx.db.insert("scans", {
      ownerId: ownerId ?? undefined,
      guestId: ownerId ? undefined : guestId,
      cvId,
      kind,
      engine,
      generalScore,
      result,
    });
    return { id };
  },
});
