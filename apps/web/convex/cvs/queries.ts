import { query } from "../_generated/server";
import { v } from "convex/values";
import { canRead } from "../_shared/utils";

/** CVs owned by the signed-in user, or (for guests) by the given guestId. */
export const listMine = query({
  args: { guestId: v.optional(v.string()) },
  handler: async (ctx, { guestId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      return await ctx.db
        .query("cvs")
        .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
        .collect();
    }
    if (guestId) {
      return await ctx.db
        .query("cvs")
        .withIndex("by_guest", (q) => q.eq("guestId", guestId))
        .collect();
    }
    return [];
  },
});

export const getById = query({
  args: { id: v.id("cvs"), guestId: v.optional(v.string()) },
  handler: async (ctx, { id, guestId }) => {
    const cv = await ctx.db.get(id);
    if (!cv) return null;
    return (await canRead(ctx, cv, guestId)) ? cv : null;
  },
});
