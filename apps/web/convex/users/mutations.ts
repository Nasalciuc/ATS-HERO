import { mutation } from "../_generated/server";

/** Inserts/updates the users-table row for the signed-in Clerk user. Call after sign-in. */
export const upsertCurrent = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
      .unique();

    const email = identity.email ?? "";
    const name = identity.name ?? undefined;

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: email || existing.email,
        name: name ?? existing.name,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", { clerkId: identity.subject, email, name });
  },
});
