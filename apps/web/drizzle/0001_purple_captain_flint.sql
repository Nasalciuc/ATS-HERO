CREATE TABLE "applications" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"company" text NOT NULL,
	"role" text NOT NULL,
	"url" text,
	"status" text DEFAULT 'applied' NOT NULL,
	"notes" text,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "apps_by_owner" ON "applications" USING btree ("owner_id");