ALTER TABLE "apply_settings" ADD COLUMN "counted_day" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "apply_settings" ADD COLUMN "sent_count" integer DEFAULT 0 NOT NULL;