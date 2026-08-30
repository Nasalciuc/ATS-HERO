import { pgTable, text, jsonb, timestamp, doublePrecision, integer,
         index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { relations, sql, type InferSelectModel } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { CvData, ScanKind, ScoreReport, JobFitReport, TemplateId, ApplicationStatus } from "@/lib/types";

const id = () => text("id").primaryKey().$defaultFn(() => nanoid());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/* ── core ─────────────────────────────────────────────────────────── */
export const users = pgTable("users", {
  id: id(),
  clerkId: text("clerk_id").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: createdAt(),                                   // ► was lost vs Convex _creationTime
}, (t) => [uniqueIndex("users_by_clerk").on(t.clerkId)]);

export const cvs = pgTable("cvs", {
  id: id(),
  ownerId: text("owner_id"),                                // Clerk subject after claim
  guestId: text("guest_id"),                                // client nanoid before sign-in
  title: text("title").notNull(),
  data: jsonb("data").$type<CvData>().notNull(),            // typed opaque blob (zod at boundary)
  template: text("template").$type<TemplateId>(),
  accent: text("accent"),
  createdAt: createdAt(),                                   // ►
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("cvs_by_owner").on(t.ownerId).where(sql`${t.ownerId} IS NOT NULL`),      // ► partial
  index("cvs_by_guest").on(t.guestId).where(sql`${t.guestId} IS NOT NULL`),      // ► partial
  index("cvs_by_owner_updated").on(t.ownerId, t.updatedAt),
  check("cvs_ownership", sql`num_nonnulls(${t.ownerId}, ${t.guestId}) >= 1`),    // ► XOR law
]);

export const scans = pgTable("scans", {
  id: id(),
  ownerId: text("owner_id"),
  guestId: text("guest_id"),
  cvId: text("cv_id").references(() => cvs.id, { onDelete: "set null" }),        // detach, not delete
  kind: text("kind").$type<ScanKind>().notNull(),
  engine: text("engine").$type<"client" | "python" | "ai">(),
  generalScore: doublePrecision("general_score").notNull(),
  result: jsonb("result").$type<ScoreReport | JobFitReport>().notNull(),
  createdAt: createdAt(),
}, (t) => [
  index("scans_by_owner").on(t.ownerId).where(sql`${t.ownerId} IS NOT NULL`),
  index("scans_by_guest").on(t.guestId).where(sql`${t.guestId} IS NOT NULL`),
  index("scans_by_cv").on(t.cvId),
  check("scans_ownership", sql`num_nonnulls(${t.ownerId}, ${t.guestId}) >= 1`),
  check("scans_score_range", sql`${t.generalScore} BETWEEN 0 AND 100`),
]);

/* ── billing-ready from day 1 (empty tables cost nothing) ─────────── */
export const aiUsage = pgTable("ai_usage", {
  ownerId: text("owner_id").notNull(),
  day: text("day").notNull(),                                // YYYY-MM-DD (UTC)
  count: integer("count").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("ai_usage_owner_day").on(t.ownerId, t.day)]);

export const webhookEvents = pgTable("webhook_events", {
  eventId: text("event_id").primaryKey(),                    // Paddle event id = idempotency
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  ownerId: text("owner_id").primaryKey(),
  paddleCustomerId: text("paddle_customer_id"),
  paddleSubscriptionId: text("paddle_subscription_id"),
  priceId: text("price_id"),
  status: text("status").$type<"active"|"trialing"|"past_due"|"canceled">().notNull(),
  kind: text("kind").$type<"season"|"monthly">(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull().defaultNow().$onUpdate(() => new Date()),
});

export const subscriptionEvents = pgTable("subscription_events", {
  id: id(),
  ownerId: text("owner_id").notNull(),
  paddleSubscriptionId: text("paddle_subscription_id").notNull(),
  eventId: text("event_id").notNull(),
  source: text("source").$type<"webhook"|"manual"|"reconcile">().notNull(),
  prevStatus: text("prev_status"),
  newStatus: text("new_status").notNull(),
  rawPayload: jsonb("raw_payload").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
}, (t) => [index("subevents_by_sub").on(t.paddleSubscriptionId)]);

/* ── application tracker (signed-in only; no guest path) ──────────── */
export const applications = pgTable("applications", {
  id: id(),
  ownerId: text("owner_id").notNull(),
  company: text("company").notNull(),
  role: text("role").notNull(),
  url: text("url"),
  status: text("status").$type<ApplicationStatus>().notNull().default("applied"),
  notes: text("notes"),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [index("apps_by_owner").on(t.ownerId)]);

/* ── relations (app-level; Ep5-7 pattern; NO hard FK to Clerk identity) ── */
export const usersRelations = relations(users, ({ many }) => ({
  cvs: many(cvs),
  applications: many(applications),
}));
export const applicationsRelations = relations(applications, ({ one }) => ({
  owner: one(users, { fields: [applications.ownerId], references: [users.clerkId] }),
}));
export const cvsRelations = relations(cvs, ({ one, many }) => ({
  owner: one(users, { fields: [cvs.ownerId], references: [users.clerkId] }),
  scans: many(scans),
}));
export const scansRelations = relations(scans, ({ one }) => ({
  cv: one(cvs, { fields: [scans.cvId], references: [cvs.id] }),
}));

/* ── single source of DB types ────────────────────────────────────── */
export type User = InferSelectModel<typeof users>;
export type Cv   = InferSelectModel<typeof cvs>;
export type Scan = InferSelectModel<typeof scans>;
export type Application = InferSelectModel<typeof applications>;
