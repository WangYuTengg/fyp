CREATE TYPE "public"."ai_job_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('grading_failed', 'grading_completed', 'batch_completed');--> statement-breakpoint
CREATE TABLE "ai_grading_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" text,
	"batch_id" uuid,
	"answer_id" uuid NOT NULL,
	"status" "ai_job_status" DEFAULT 'pending' NOT NULL,
	"tokens_used" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost" text,
	"error" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_usage_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" timestamp NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"total_cost" text DEFAULT '0' NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"avg_processing_time" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_stats_date_provider_model_unique" UNIQUE("date","provider","model")
);
--> statement-breakpoint
CREATE TABLE "rubrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"criteria" jsonb NOT NULL,
	"total_points" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rubrics_question_id_unique" UNIQUE("question_id")
);
--> statement-breakpoint
CREATE TABLE "staff_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"data" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marks" ADD COLUMN "ai_suggestion_accepted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "ai_grading_jobs" ADD CONSTRAINT "ai_grading_jobs_answer_id_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."answers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubrics" ADD CONSTRAINT "rubrics_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_notifications" ADD CONSTRAINT "staff_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_grading_jobs_answer_id_idx" ON "ai_grading_jobs" USING btree ("answer_id");--> statement-breakpoint
CREATE INDEX "ai_grading_jobs_batch_id_idx" ON "ai_grading_jobs" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "ai_grading_jobs_status_idx" ON "ai_grading_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_usage_stats_date_idx" ON "ai_usage_stats" USING btree ("date");--> statement-breakpoint
CREATE INDEX "staff_notifications_user_id_idx" ON "staff_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "staff_notifications_read_idx" ON "staff_notifications" USING btree ("read");