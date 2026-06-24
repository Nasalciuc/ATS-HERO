import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { scanKindValidator } from "../_shared/validators";
import { getOwnerId } from "../_shared/utils";

/** Persists a score / job-fit result for the signed-in user or guest. */
export const save = mutation({
  args: {
    kind: scanKindValidator,
    generalScore: v.number(),
    result: v.any(),
    cvId: v.optional(v.id("cvs")),
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, { kind, generalScore, result, cvId, guestId }) => {
    const ownerId = await getOwnerId(ctx);
    const id = await ctx.db.insert("scans", {
      ownerId: ownerId ?? undefined,
      guestId: ownerId ? undefined : guestId,
      cvId,
      kind,
      generalScore,
      result,
    });
    return { id };
  },
});
