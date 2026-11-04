CREATE TABLE "job_searches" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"search_term" text NOT NULL,
	"country" text NOT NULL,
	"city" text,
	"remote_only" boolean DEFAULT false NOT NULL,
	"boards" jsonb NOT NULL,
	"per_day" integer DEFAULT 10 NOT NULL,
	"cv_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_found" integer,
	"last_added" integer,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_searches_per_day" CHECK ("job_searches"."per_day" BETWEEN 1 AND 20)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "job_searches_by_owner" ON "job_searches" USING btree ("owner_id");