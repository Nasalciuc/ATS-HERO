import { query } from "../_generated/server";
import { v } from "convex/values";
import { canRead } from "../_shared/utils";

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
