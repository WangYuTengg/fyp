-- Add indexes on foreign key columns for better query performance
-- These indexes improve JOIN performance and foreign key constraint checks

-- Enrollments table
CREATE INDEX IF NOT EXISTS enrollments_user_id_idx ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS enrollments_course_id_idx ON enrollments(course_id);

-- Assignments table
CREATE INDEX IF NOT EXISTS assignments_course_id_idx ON assignments(course_id);
CREATE INDEX IF NOT EXISTS assignments_created_by_idx ON assignments(created_by);

-- Assignment questions table
CREATE INDEX IF NOT EXISTS assignment_questions_assignment_id_idx ON assignment_questions(assignment_id);
CREATE INDEX IF NOT EXISTS assignment_questions_question_id_idx ON assignment_questions(question_id);

-- Answers table
CREATE INDEX IF NOT EXISTS answers_submission_id_idx ON answers(submission_id);
CREATE INDEX IF NOT EXISTS answers_question_id_idx ON answers(question_id);

-- Marks table  
CREATE INDEX IF NOT EXISTS marks_submission_id_idx ON marks(submission_id);
CREATE INDEX IF NOT EXISTS marks_answer_id_idx ON marks(answer_id);
CREATE INDEX IF NOT EXISTS marks_marked_by_idx ON marks(marked_by);

-- Rubrics table
CREATE INDEX IF NOT EXISTS rubrics_question_id_idx ON rubrics(question_id);

-- Additional composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS submissions_user_assignment_idx ON submissions(user_id, assignment_id);
CREATE INDEX IF NOT EXISTS submissions_assignment_status_idx ON submissions(assignment_id, status);
CREATE INDEX IF NOT EXISTS answers_submission_question_idx ON answers(submission_id, question_id);
CREATE INDEX IF NOT EXISTS marks_submission_answer_idx ON marks(submission_id, answer_id);
