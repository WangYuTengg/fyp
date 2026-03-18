ALTER TABLE "assignments" ADD COLUMN "results_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "results_published_at" timestamp;--> statement-breakpoint
ALTER TABLE "marks" ADD COLUMN "override_reason" text;--> statement-breakpoint
ALTER TABLE "marks" ADD COLUMN "previous_score" integer;--> statement-breakpoint
ALTER TABLE "marks" ADD COLUMN "overridden_at" timestamp;