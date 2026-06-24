import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { cvDataValidator, scanKindValidator } from "./_shared/validators";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  }).index("by_clerk", ["clerkId"]),

  cvs: defineTable({
    ownerId: v.optional(v.string()), // Clerk subject, set after claim
    guestId: v.optional(v.string()), // client nanoid, before sign-in
    title: v.string(),
    data: cvDataValidator,
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_guest", ["guestId"]),

  scans: defineTable({
    ownerId: v.optional(v.string()),
    guestId: v.optional(v.string()),
    cvId: v.optional(v.id("cvs")),
    kind: scanKindValidator,
    generalScore: v.number(),
    result: v.any(), // ScoreReport | JobFitReport snapshot
  })
    .index("by_owner", ["ownerId"])
    .index("by_guest", ["guestId"]),

  // subscriptions: deferred until Stripe (Tier 3).
});
