import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { cvDataValidator } from "../_shared/validators";
import { getOwnerId, assertCanWrite } from "../_shared/utils";

export const create = mutation({
  args: {
    title: v.optional(v.string()),
    data: cvDataValidator,
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, { title, data, guestId }) => {
    const ownerId = await getOwnerId(ctx);
    const id = await ctx.db.insert("cvs", {
      ownerId: ownerId ?? undefined,
      guestId: ownerId ? undefined : guestId,
      title: title ?? "My resume",
      data,
      updatedAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const update = mutation({
  args: {
    id: v.id("cvs"),
    data: cvDataValidator,
    title: v.optional(v.string()),
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, { id, data, title, guestId }) => {
    const cv = await ctx.db.get(id);
    if (!cv) throw new Error("CV not found");
    await assertCanWrite(ctx, cv, guestId);
    await ctx.db.patch(id, {
      data,
      ...(title !== undefined ? { title } : {}),
      updatedAt: Date.now(),
    });
    return await ctx.db.get(id);
  },
});

export const remove = mutation({
  args: { id: v.id("cvs"), guestId: v.optional(v.string()) },
  handler: async (ctx, { id, guestId }) => {
    const cv = await ctx.db.get(id);
    if (!cv) return { ok: true as const };
    await assertCanWrite(ctx, cv, guestId);
    await ctx.db.delete(id);
    return { ok: true as const };
  },
});

/**
 * Re-assigns all guest cvs AND scans to the now-signed-in user.
 * Attaches (does not overwrite): existing account documents are kept.
 */
export const claimGuest = mutation({
  args: { guestId: v.string() },
  handler: async (ctx, { guestId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const ownerId = identity.subject;

    const cvs = await ctx.db
      .query("cvs")
      .withIndex("by_guest", (q) => q.eq("guestId", guestId))
      .collect();
    for (const cv of cvs) {
      await ctx.db.patch(cv._id, { ownerId, guestId: undefined });
    }

    const scans = await ctx.db
      .query("scans")
      .withIndex("by_guest", (q) => q.eq("guestId", guestId))
      .collect();
    for (const s of scans) {
      await ctx.db.patch(s._id, { ownerId, guestId: undefined });
    }

    return { cvs: cvs.length, scans: scans.length };
  },
});
