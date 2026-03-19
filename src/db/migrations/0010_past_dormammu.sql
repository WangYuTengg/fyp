ALTER TYPE "public"."notification_type" ADD VALUE 'auto_submitted';--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
DROP TABLE "file_uploads" CASCADE;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "monitor_focus" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "max_tab_switches" integer;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "shuffle_questions" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "late_penalty_type" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "late_penalty_value" numeric;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "late_penalty_cap" numeric;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "attempt_scoring_method" text DEFAULT 'latest' NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "results_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "results_published_at" timestamp;--> statement-breakpoint
ALTER TABLE "marks" ADD COLUMN "override_reason" text;--> statement-breakpoint
ALTER TABLE "marks" ADD COLUMN "previous_score" integer;--> statement-breakpoint
ALTER TABLE "marks" ADD COLUMN "overridden_at" timestamp;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "tab_switches" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "question_order" jsonb;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "auto_submitted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "late_penalty_applied" numeric;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "late_penalty_details" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deactivated_at" timestamp;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" DROP COLUMN "file_url";