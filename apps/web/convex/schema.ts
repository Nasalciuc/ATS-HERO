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
    template: v.optional(v.string()), // "classic" | "modern" | "minimal" (presentation pref)
    accent: v.optional(v.string()),   // hex from TOKENS.primaries
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_guest", ["guestId"])
    .index("by_owner_updated", ["ownerId", "updatedAt"]),

  scans: defineTable({
    ownerId: v.optional(v.string()),
    guestId: v.optional(v.string()),
    cvId: v.optional(v.id("cvs")),
    kind: scanKindValidator,
    engine: v.optional(v.string()), // "client" (Tier 0/1) | "python" (Tier 2) | "ai" (Tier 3)
    generalScore: v.number(),
    result: v.any(), // ScoreReport | JobFitReport snapshot — intentionally loose (evolves per engine)
  })
    .index("by_owner", ["ownerId"])
    .index("by_guest", ["guestId"])
    .index("by_cv", ["cvId"]),

  // subscriptions: DEFERRED until Stripe (Tier 3). Planned shape (do not add yet):
  //   ownerId, stripeCustomerId, stripeSubscriptionId, plan, status, currentPeriodEnd
  // usage metering: DEFERRED — count from `scans` via by_owner + _creationTime when limits arrive.
});
