CREATE TABLE "apply_queue" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"application_id" text NOT NULL,
	"cv_id" text NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"reason" text,
	"ready_until" timestamp with time zone,
	"sending_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"confirmation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apply_settings" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"daily_limit" integer DEFAULT 5 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apply_settings_daily_limit" CHECK ("apply_settings"."daily_limit" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE INDEX "apply_queue_by_owner" ON "apply_queue" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "apply_queue_by_application" ON "apply_queue" USING btree ("application_id");