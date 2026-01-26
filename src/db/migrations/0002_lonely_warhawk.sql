CREATE INDEX "questions_course_id_idx" ON "questions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "submissions_user_id_idx" ON "submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "submissions_assignment_id_idx" ON "submissions" USING btree ("assignment_id");--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_submission_id_question_id_unique" UNIQUE("submission_id","question_id");--> statement-breakpoint
ALTER TABLE "assignment_questions" ADD CONSTRAINT "assignment_questions_assignment_id_question_id_unique" UNIQUE("assignment_id","question_id");--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_course_id_unique" UNIQUE("user_id","course_id");