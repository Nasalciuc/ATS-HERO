CREATE TABLE "application_events" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "platform" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "url_key" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "cv_id" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "cv_hash" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "applied_via" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "fit_met" integer;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "fit_total" integer;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "follow_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "archive_reason" text;--> statement-breakpoint
CREATE INDEX "app_events_by_app" ON "application_events" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "app_events_by_owner" ON "application_events" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "apps_by_owner_url" ON "applications" USING btree ("owner_id","url_key") WHERE "applications"."url_key" IS NOT NULL;--> statement-breakpoint
-- v1 rows were all sent jobs (applied, interview, offer, rejected): their sending date is the day they were added
UPDATE "applications" SET "submitted_at" = "applied_at" WHERE "submitted_at" IS NULL;
