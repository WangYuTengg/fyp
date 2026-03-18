ALTER TABLE "assignments" ADD COLUMN "monitor_focus" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "max_tab_switches" integer;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "tab_switches" jsonb DEFAULT '[]'::jsonb NOT NULL;