CREATE TABLE "interview_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"application_id" text NOT NULL,
	"cv_id" text NOT NULL,
	"kind" text NOT NULL,
	"style" text NOT NULL,
	"minutes" integer NOT NULL,
	"mode" text NOT NULL,
	"feedback_when" text DEFAULT 'each' NOT NULL,
	"timer" boolean DEFAULT false NOT NULL,
	"english_notes" boolean DEFAULT true NOT NULL,
	"pack" jsonb NOT NULL,
	"status" text DEFAULT 'live' NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"seconds_used" integer DEFAULT 0 NOT NULL,
	"from_session_id" text,
	"prepared" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interview_sessions_kind" CHECK ("interview_sessions"."kind" IN ('recruiter', 'technical', 'manager')),
	CONSTRAINT "interview_sessions_style" CHECK ("interview_sessions"."style" IN ('friendly', 'neutral', 'tough')),
	CONSTRAINT "interview_sessions_minutes" CHECK ("interview_sessions"."minutes" IN (10, 20)),
	CONSTRAINT "interview_sessions_mode" CHECK ("interview_sessions"."mode" IN ('voice', 'typing'))
);
--> statement-breakpoint
CREATE TABLE "interview_turns" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"position" integer NOT NULL,
	"round" integer NOT NULL,
	"kind" text NOT NULL,
	"question_id" text NOT NULL,
	"question" text NOT NULL,
	"requirement" text,
	"bullet" jsonb,
	"answer" text,
	"answered_by" text,
	"measures" jsonb,
	"feedback" jsonb,
	"better" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interview_turns_kind" CHECK ("interview_turns"."kind" IN ('question', 'follow_up'))
);
--> statement-breakpoint
CREATE INDEX "interview_sessions_by_owner" ON "interview_sessions" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "interview_sessions_by_application" ON "interview_sessions" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interview_turns_by_session" ON "interview_turns" USING btree ("session_id","position");--> statement-breakpoint
CREATE INDEX "interview_turns_by_owner" ON "interview_turns" USING btree ("owner_id");