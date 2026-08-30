CREATE TABLE "ai_usage" (
	"owner_id" text NOT NULL,
	"day" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cvs" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text,
	"guest_id" text,
	"title" text NOT NULL,
	"data" jsonb NOT NULL,
	"template" text,
	"accent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cvs_ownership" CHECK (num_nonnulls("cvs"."owner_id", "cvs"."guest_id") >= 1)
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text,
	"guest_id" text,
	"cv_id" text,
	"kind" text NOT NULL,
	"engine" text,
	"general_score" double precision NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scans_ownership" CHECK (num_nonnulls("scans"."owner_id", "scans"."guest_id") >= 1),
	CONSTRAINT "scans_score_range" CHECK ("scans"."general_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"paddle_subscription_id" text NOT NULL,
	"event_id" text NOT NULL,
	"source" text NOT NULL,
	"prev_status" text,
	"new_status" text NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"paddle_customer_id" text,
	"paddle_subscription_id" text,
	"price_id" text,
	"status" text NOT NULL,
	"kind" text,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_cv_id_cvs_id_fk" FOREIGN KEY ("cv_id") REFERENCES "public"."cvs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_owner_day" ON "ai_usage" USING btree ("owner_id","day");--> statement-breakpoint
CREATE INDEX "cvs_by_owner" ON "cvs" USING btree ("owner_id") WHERE "cvs"."owner_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "cvs_by_guest" ON "cvs" USING btree ("guest_id") WHERE "cvs"."guest_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "cvs_by_owner_updated" ON "cvs" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "scans_by_owner" ON "scans" USING btree ("owner_id") WHERE "scans"."owner_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "scans_by_guest" ON "scans" USING btree ("guest_id") WHERE "scans"."guest_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "scans_by_cv" ON "scans" USING btree ("cv_id");--> statement-breakpoint
CREATE INDEX "subevents_by_sub" ON "subscription_events" USING btree ("paddle_subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_by_clerk" ON "users" USING btree ("clerk_id");