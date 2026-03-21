-- Migration: Enable Row Level Security on all tables (Supabase-compatible)
-- Strategy: Use Supabase's built-in `authenticated` role with request.jwt.claims.
-- The DB owner (postgres) bypasses RLS — used by migrations and Graphile Worker.
-- The web server sets request.jwt.claims + SET LOCAL ROLE authenticated per-request.
--
-- Policies use Supabase helpers:
--   auth.uid()                    — user UUID from JWT sub claim
--   auth.jwt() ->> 'user_role'   — app-level role (admin/staff/student)

-- 1. Grant table permissions to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO authenticated;

-- 2. Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_grading_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES
-- ============================================================

-- ---- users ----
-- All authenticated users can read user records (display names, etc.)
CREATE POLICY users_select ON users FOR SELECT TO authenticated
  USING (true);

CREATE POLICY users_insert ON users FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');

CREATE POLICY users_update ON users FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR (auth.jwt() ->> 'user_role') = 'admin'
  );

CREATE POLICY users_delete ON users FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin');

-- ---- password_reset_tokens ----
-- Users can only access their own tokens
CREATE POLICY prt_select ON password_reset_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY prt_insert ON password_reset_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY prt_update ON password_reset_tokens FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY prt_delete ON password_reset_tokens FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---- refresh_tokens ----
-- Users can only access their own tokens
CREATE POLICY rt_select ON refresh_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY rt_insert ON refresh_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY rt_update ON refresh_tokens FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY rt_delete ON refresh_tokens FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---- courses ----
-- All authenticated users can view courses; only admin/staff can modify
CREATE POLICY courses_select ON courses FOR SELECT TO authenticated
  USING (true);

CREATE POLICY courses_insert ON courses FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

CREATE POLICY courses_update ON courses FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

CREATE POLICY courses_delete ON courses FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

-- ---- enrollments ----
-- Users see their own enrollments; admin/staff see all
CREATE POLICY enrollments_select ON enrollments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (auth.jwt() ->> 'user_role') IN ('admin', 'staff')
  );

CREATE POLICY enrollments_insert ON enrollments FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

CREATE POLICY enrollments_update ON enrollments FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

CREATE POLICY enrollments_delete ON enrollments FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

-- ---- questions ----
-- All can read (app-layer handles course-scoped filtering); only admin/staff can modify
CREATE POLICY questions_select ON questions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY questions_insert ON questions FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

CREATE POLICY questions_update ON questions FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

CREATE POLICY questions_delete ON questions FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

-- ---- assignments ----
-- All can read (app-layer handles published/enrollment filtering); only admin/staff can modify
CREATE POLICY assignments_select ON assignments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY assignments_insert ON assignments FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

CREATE POLICY assignments_update ON assignments FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

CREATE POLICY assignments_delete ON assignments FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

-- ---- assignment_questions ----
-- All can read; only admin/staff can modify
CREATE POLICY aq_select ON assignment_questions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY aq_insert ON assignment_questions FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

CREATE POLICY aq_update ON assignment_questions FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

CREATE POLICY aq_delete ON assignment_questions FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

-- ---- submissions ----
-- Students see/create their own; admin/staff see all
CREATE POLICY submissions_select ON submissions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (auth.jwt() ->> 'user_role') IN ('admin', 'staff')
  );

CREATE POLICY submissions_insert ON submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY submissions_update ON submissions FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (auth.jwt() ->> 'user_role') IN ('admin', 'staff')
  );

CREATE POLICY submissions_delete ON submissions FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

-- ---- answers ----
-- Students access answers for their own submissions; admin/staff access all
CREATE POLICY answers_select ON answers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = answers.submission_id
      AND (
        s.user_id = auth.uid()
        OR (auth.jwt() ->> 'user_role') IN ('admin', 'staff')
      )
    )
  );

CREATE POLICY answers_insert ON answers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = answers.submission_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY answers_update ON answers FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = answers.submission_id
      AND (
        s.user_id = auth.uid()
        OR (auth.jwt() ->> 'user_role') IN ('admin', 'staff')
      )
    )
  );

CREATE POLICY answers_delete ON answers FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

-- ---- marks ----
-- Students can read marks on their own submissions; admin/staff can read/write all
CREATE POLICY marks_select ON marks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = marks.submission_id
      AND (
        s.user_id = auth.uid()
        OR (auth.jwt() ->> 'user_role') IN ('admin', 'staff')
      )
    )
  );

CREATE POLICY marks_insert ON marks FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

CREATE POLICY marks_update ON marks FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

CREATE POLICY marks_delete ON marks FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

-- ---- rubrics ----
-- All can read rubrics; only admin/staff can modify
CREATE POLICY rubrics_select ON rubrics FOR SELECT TO authenticated
  USING (true);

CREATE POLICY rubrics_insert ON rubrics FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

CREATE POLICY rubrics_update ON rubrics FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

CREATE POLICY rubrics_delete ON rubrics FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

-- ---- ai_grading_jobs ----
-- Admin/staff only
CREATE POLICY agj_select ON ai_grading_jobs FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

CREATE POLICY agj_insert ON ai_grading_jobs FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

CREATE POLICY agj_update ON ai_grading_jobs FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

CREATE POLICY agj_delete ON ai_grading_jobs FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

-- ---- ai_usage_stats ----
-- Admin only
CREATE POLICY aus_select ON ai_usage_stats FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin');

CREATE POLICY aus_insert ON ai_usage_stats FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');

CREATE POLICY aus_update ON ai_usage_stats FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin');

CREATE POLICY aus_delete ON ai_usage_stats FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin');

-- ---- staff_notifications ----
-- Users see their own; admin sees all; admin/staff can create
CREATE POLICY sn_select ON staff_notifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (auth.jwt() ->> 'user_role') = 'admin'
  );

CREATE POLICY sn_insert ON staff_notifications FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') IN ('admin', 'staff'));

CREATE POLICY sn_update ON staff_notifications FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (auth.jwt() ->> 'user_role') = 'admin'
  );

CREATE POLICY sn_delete ON staff_notifications FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (auth.jwt() ->> 'user_role') = 'admin'
  );

-- ---- system_settings ----
-- All can read; only admin can modify
CREATE POLICY ss_select ON system_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY ss_insert ON system_settings FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'user_role') = 'admin');

CREATE POLICY ss_update ON system_settings FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin');

CREATE POLICY ss_delete ON system_settings FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'user_role') = 'admin');
