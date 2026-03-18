ALTER TYPE "public"."notification_type" ADD VALUE 'auto_submitted';--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "shuffle_questions" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "late_penalty_type" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "late_penalty_value" numeric;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "late_penalty_cap" numeric;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "attempt_scoring_method" text DEFAULT 'latest' NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "question_order" jsonb;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "auto_submitted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "late_penalty_applied" numeric;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "late_penalty_details" jsonb;