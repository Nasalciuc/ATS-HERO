// Flat module on purpose: the client (lib/api.ts, hooks) references api.cvs.*, which
// resolves to the "cvs:*" function path. Keep queries + mutations in this one file —
// nesting them under convex/cvs/ would change the deployed paths and break the client.
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { cvDataValidator } from "./_shared/validators";
import { getOwnerId, canRead, assertCanWrite } from "./_shared/utils";

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

    // Integrity: keep the user's scan history (reports are standalone snapshots),
    // but detach the dangling reference.
    const related = await ctx.db
      .query("scans")
      .withIndex("by_cv", (q) => q.eq("cvId", id))
      .collect();
    for (const s of related) await ctx.db.patch(s._id, { cvId: undefined });

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
