import { pgTable, text, jsonb, timestamp, doublePrecision, integer, boolean,
         index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { relations, sql, type InferSelectModel } from "drizzle-orm";
import { nanoid } from "nanoid";
import type {
  CvData, ScanKind, ScoreReport, JobFitReport, TemplateId, ApplicationStatus,
  ApplicationSource, ApplyPlatform, AppliedVia, ArchiveReason, ApplicationEventKind, JobBoard, QueueStatus,
} from "@/lib/types";

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
  /** v1 meaning kept: the day the row was added. The real sending date is `submittedAt`. */
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull().defaultNow().$onUpdate(() => new Date()),
  /* ── Tracker v2 (TRACKER-V2-DESIGN.md §7.1): all nullable, added without touching v1 rows ── */
  source: text("source").$type<ApplicationSource>(),
  platform: text("platform").$type<ApplyPlatform>(),
  location: text("location"),
  description: text("description"),
  /** the link, normalised (`lib/job-url.ts`): one row per job and owner */
  urlKey: text("url_key"),
  /** the CV that was sent, and its exact version */
  cvId: text("cv_id"),
  cvHash: text("cv_hash"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  appliedVia: text("applied_via").$type<AppliedVia>(),
  /** the post's required items the CV met, when it was sent */
  fitMet: integer("fit_met"),
  fitTotal: integer("fit_total"),
  followUpAt: timestamp("follow_up_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archiveReason: text("archive_reason").$type<ArchiveReason>(),
}, (t) => [
  index("apps_by_owner").on(t.ownerId),
  uniqueIndex("apps_by_owner_url").on(t.ownerId, t.urlKey).where(sql`${t.urlKey} IS NOT NULL`),
]);

/** A job's history: one row per event, only added (TRACKER-V2-DESIGN.md §7.2). No CV text, no answers. */
export const applicationEvents = pgTable("application_events", {
  id: id(),
  applicationId: text("application_id").notNull(),
  ownerId: text("owner_id").notNull(),
  kind: text("kind").$type<ApplicationEventKind>().notNull(),
  fromStatus: text("from_status").$type<ApplicationStatus>(),
  toStatus: text("to_status").$type<ApplicationStatus>(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("app_events_by_app").on(t.applicationId),
  index("app_events_by_owner").on(t.ownerId),
]);

/**
 * Daily search (canvas "ATS Hero Tracker v2", page "Search & agent"): one per owner. Each morning
 * the new postings that fit the CV best go to Saved. Only the title and the place reach the boards.
 */
export const jobSearches = pgTable("job_searches", {
  id: id(),
  ownerId: text("owner_id").notNull(),
  /** the job title searched for, e.g. "Data Analyst" */
  searchTerm: text("search_term").notNull(),
  /** the country as JobSpy names it for Indeed ("romania"); `lib/job-search.ts` lists them */
  country: text("country").notNull(),
  city: text("city"),
  remoteOnly: boolean("remote_only").notNull().default(false),
  boards: jsonb("boards").$type<JobBoard[]>().notNull(),
  /** at most this many new jobs go to Saved a day */
  perDay: integer("per_day").notNull().default(10),
  /** the CV the postings are checked against; null: the one changed last */
  cvId: text("cv_id"),
  enabled: boolean("enabled").notNull().default(true),
  /** the last run, for "Last search": when, how many found, how many added, what failed */
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastFound: integer("last_found"),
  lastAdded: integer("last_added"),
  lastError: text("last_error"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("job_searches_by_owner").on(t.ownerId),
  check("job_searches_per_day", sql`${t.perDay} BETWEEN 1 AND 20`),
]);

/**
 * "Ready to send" (canvas page "Search & agent"): the jobs a person queued for the apply agent, one
 * row per job. No answers, no screenshots, nothing the form showed: only where the job is and when.
 */
export const applyQueue = pgTable("apply_queue", {
  id: id(),
  ownerId: text("owner_id").notNull(),
  applicationId: text("application_id").notNull(),
  /** the CV the agent attaches and takes the contact details from */
  cvId: text("cv_id").notNull(),
  status: text("status").$type<QueueStatus>().notNull().default("waiting"),
  /** why it stopped: a handoff (captcha, login…), a refusal (workday, linkedin…), or what broke */
  reason: text("reason"),
  /** the form stays open for the person until then */
  readyUntil: timestamp("ready_until", { withTimezone: true }),
  /** Send was pressed: counts against the daily limit from here */
  sendingAt: timestamp("sending_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  /** the words on the page that confirmed it ("Thank you for applying"), nothing else of the page */
  confirmation: text("confirmation"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("apply_queue_by_owner").on(t.ownerId),
  uniqueIndex("apply_queue_by_application").on(t.applicationId),
]);

/** The daily limit the person set for the agent's applications (1 to 10, 5 until they change it). */
export const applySettings = pgTable("apply_settings", {
  ownerId: text("owner_id").primaryKey(),
  dailyLimit: integer("daily_limit").notNull().default(5),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  check("apply_settings_daily_limit", sql`${t.dailyLimit} BETWEEN 1 AND 10`),
]);

/* ── relations (app-level; Ep5-7 pattern; NO hard FK to Clerk identity) ── */
export const usersRelations = relations(users, ({ many }) => ({
  cvs: many(cvs),
  applications: many(applications),
}));
export const applicationsRelations = relations(applications, ({ one, many }) => ({
  owner: one(users, { fields: [applications.ownerId], references: [users.clerkId] }),
  events: many(applicationEvents),
}));
export const applicationEventsRelations = relations(applicationEvents, ({ one }) => ({
  application: one(applications, { fields: [applicationEvents.applicationId], references: [applications.id] }),
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
export type ApplicationEvent = InferSelectModel<typeof applicationEvents>;
export type JobSearch = InferSelectModel<typeof jobSearches>;
export type QueueItem = InferSelectModel<typeof applyQueue>;
