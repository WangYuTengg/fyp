-- Migration: Enable Row Level Security on all tables
-- Strategy: Create an app_user role (NOLOGIN) for the web server.
-- The DB owner (used by migrations, Graphile Worker) bypasses RLS automatically.
-- The web server does SET LOCAL ROLE app_user per-request inside a transaction.

-- 1. Create app_user role
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END $$;

-- 2. Grant app_user to current DB owner (enables SET LOCAL ROLE app_user)
DO $$
BEGIN
  EXECUTE format('GRANT app_user TO %I', current_user);
END $$;

-- 3. Grant table permissions to app_user
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO app_user;

-- 4. Enable RLS on all tables
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
-- Session variables used by policies:
--   app.current_user_id   — UUID of the authenticated user
--   app.current_user_role — 'admin' | 'staff' | 'student'
-- ============================================================

-- Helper expression used throughout:
--   NULLIF(current_setting('app.current_user_id', true), '')::uuid
--   current_setting('app.current_user_role', true)

-- ---- users ----
-- All authenticated users can read user records (for display names, etc.)
CREATE POLICY users_select ON users FOR SELECT TO app_user
  USING (true);

CREATE POLICY users_insert ON users FOR INSERT TO app_user
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY users_update ON users FOR UPDATE TO app_user
  USING (
    id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR current_setting('app.current_user_role', true) = 'admin'
  );

CREATE POLICY users_delete ON users FOR DELETE TO app_user
  USING (current_setting('app.current_user_role', true) = 'admin');

-- ---- password_reset_tokens ----
-- Users can only access their own tokens
CREATE POLICY prt_select ON password_reset_tokens FOR SELECT TO app_user
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY prt_insert ON password_reset_tokens FOR INSERT TO app_user
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY prt_update ON password_reset_tokens FOR UPDATE TO app_user
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY prt_delete ON password_reset_tokens FOR DELETE TO app_user
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- ---- refresh_tokens ----
-- Users can only access their own tokens
CREATE POLICY rt_select ON refresh_tokens FOR SELECT TO app_user
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY rt_insert ON refresh_tokens FOR INSERT TO app_user
  WITH CHECK (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY rt_update ON refresh_tokens FOR UPDATE TO app_user
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

CREATE POLICY rt_delete ON refresh_tokens FOR DELETE TO app_user
  USING (user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- ---- courses ----
-- All authenticated users can view courses; only admin/staff can modify
CREATE POLICY courses_select ON courses FOR SELECT TO app_user
  USING (true);

CREATE POLICY courses_insert ON courses FOR INSERT TO app_user
  WITH CHECK (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

CREATE POLICY courses_update ON courses FOR UPDATE TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

CREATE POLICY courses_delete ON courses FOR DELETE TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

-- ---- enrollments ----
-- Users see their own enrollments; admin/staff see all
CREATE POLICY enrollments_select ON enrollments FOR SELECT TO app_user
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR current_setting('app.current_user_role', true) IN ('admin', 'staff')
  );

CREATE POLICY enrollments_insert ON enrollments FOR INSERT TO app_user
  WITH CHECK (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

CREATE POLICY enrollments_update ON enrollments FOR UPDATE TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

CREATE POLICY enrollments_delete ON enrollments FOR DELETE TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

-- ---- questions ----
-- All can read (app-layer handles course-scoped filtering); only admin/staff can modify
CREATE POLICY questions_select ON questions FOR SELECT TO app_user
  USING (true);

CREATE POLICY questions_insert ON questions FOR INSERT TO app_user
  WITH CHECK (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

CREATE POLICY questions_update ON questions FOR UPDATE TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

CREATE POLICY questions_delete ON questions FOR DELETE TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

-- ---- assignments ----
-- All can read (app-layer handles published/enrollment filtering); only admin/staff can modify
CREATE POLICY assignments_select ON assignments FOR SELECT TO app_user
  USING (true);

CREATE POLICY assignments_insert ON assignments FOR INSERT TO app_user
  WITH CHECK (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

CREATE POLICY assignments_update ON assignments FOR UPDATE TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

CREATE POLICY assignments_delete ON assignments FOR DELETE TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

-- ---- assignment_questions ----
-- All can read; only admin/staff can modify
CREATE POLICY aq_select ON assignment_questions FOR SELECT TO app_user
  USING (true);

CREATE POLICY aq_insert ON assignment_questions FOR INSERT TO app_user
  WITH CHECK (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

CREATE POLICY aq_update ON assignment_questions FOR UPDATE TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

CREATE POLICY aq_delete ON assignment_questions FOR DELETE TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

-- ---- submissions ----
-- Students see/create their own; admin/staff see all
CREATE POLICY submissions_select ON submissions FOR SELECT TO app_user
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR current_setting('app.current_user_role', true) IN ('admin', 'staff')
  );

CREATE POLICY submissions_insert ON submissions FOR INSERT TO app_user
  WITH CHECK (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
  );

CREATE POLICY submissions_update ON submissions FOR UPDATE TO app_user
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR current_setting('app.current_user_role', true) IN ('admin', 'staff')
  );

CREATE POLICY submissions_delete ON submissions FOR DELETE TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

-- ---- answers ----
-- Students access answers for their own submissions; admin/staff access all
CREATE POLICY answers_select ON answers FOR SELECT TO app_user
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = answers.submission_id
      AND (
        s.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR current_setting('app.current_user_role', true) IN ('admin', 'staff')
      )
    )
  );

CREATE POLICY answers_insert ON answers FOR INSERT TO app_user
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = answers.submission_id
      AND s.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    )
  );

CREATE POLICY answers_update ON answers FOR UPDATE TO app_user
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = answers.submission_id
      AND (
        s.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR current_setting('app.current_user_role', true) IN ('admin', 'staff')
      )
    )
  );

CREATE POLICY answers_delete ON answers FOR DELETE TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

-- ---- marks ----
-- Students can read marks on their own submissions; admin/staff can read/write all
CREATE POLICY marks_select ON marks FOR SELECT TO app_user
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = marks.submission_id
      AND (
        s.user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
        OR current_setting('app.current_user_role', true) IN ('admin', 'staff')
      )
    )
  );

CREATE POLICY marks_insert ON marks FOR INSERT TO app_user
  WITH CHECK (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

CREATE POLICY marks_update ON marks FOR UPDATE TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

CREATE POLICY marks_delete ON marks FOR DELETE TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

-- ---- rubrics ----
-- All can read rubrics; only admin/staff can modify
CREATE POLICY rubrics_select ON rubrics FOR SELECT TO app_user
  USING (true);

CREATE POLICY rubrics_insert ON rubrics FOR INSERT TO app_user
  WITH CHECK (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

CREATE POLICY rubrics_update ON rubrics FOR UPDATE TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

CREATE POLICY rubrics_delete ON rubrics FOR DELETE TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

-- ---- ai_grading_jobs ----
-- Admin/staff only
CREATE POLICY agj_select ON ai_grading_jobs FOR SELECT TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

CREATE POLICY agj_insert ON ai_grading_jobs FOR INSERT TO app_user
  WITH CHECK (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

CREATE POLICY agj_update ON ai_grading_jobs FOR UPDATE TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

CREATE POLICY agj_delete ON ai_grading_jobs FOR DELETE TO app_user
  USING (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

-- ---- ai_usage_stats ----
-- Admin only
CREATE POLICY aus_select ON ai_usage_stats FOR SELECT TO app_user
  USING (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY aus_insert ON ai_usage_stats FOR INSERT TO app_user
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY aus_update ON ai_usage_stats FOR UPDATE TO app_user
  USING (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY aus_delete ON ai_usage_stats FOR DELETE TO app_user
  USING (current_setting('app.current_user_role', true) = 'admin');

-- ---- staff_notifications ----
-- Users see their own; admin sees all; admin/staff can create
CREATE POLICY sn_select ON staff_notifications FOR SELECT TO app_user
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR current_setting('app.current_user_role', true) = 'admin'
  );

CREATE POLICY sn_insert ON staff_notifications FOR INSERT TO app_user
  WITH CHECK (current_setting('app.current_user_role', true) IN ('admin', 'staff'));

CREATE POLICY sn_update ON staff_notifications FOR UPDATE TO app_user
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR current_setting('app.current_user_role', true) = 'admin'
  );

CREATE POLICY sn_delete ON staff_notifications FOR DELETE TO app_user
  USING (
    user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR current_setting('app.current_user_role', true) = 'admin'
  );

-- ---- system_settings ----
-- All can read; only admin can modify
CREATE POLICY ss_select ON system_settings FOR SELECT TO app_user
  USING (true);

CREATE POLICY ss_insert ON system_settings FOR INSERT TO app_user
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY ss_update ON system_settings FOR UPDATE TO app_user
  USING (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY ss_delete ON system_settings FOR DELETE TO app_user
  USING (current_setting('app.current_user_role', true) = 'admin');
