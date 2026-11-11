CREATE TABLE "ai_consents" (
	"owner_id" text NOT NULL,
	"version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD COLUMN "ai" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD COLUMN "pending" jsonb;--> statement-breakpoint
ALTER TABLE "interview_turns" ADD COLUMN "dismissed" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_consents_owner_version" ON "ai_consents" USING btree ("owner_id","version");