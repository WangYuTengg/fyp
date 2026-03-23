# Database Layer

Schema-first PostgreSQL database using Drizzle ORM with 16 tables and auto-generated SQL migrations.

## Design Decisions

### Schema-First with Drizzle ORM

**Trade-off:** More upfront schema definition work vs. full control over generated SQL.

The schema is defined in TypeScript (`schema.ts`) and migrations are generated as plain SQL files. This was chosen over Prisma's introspection-first workflow because:

- Generated SQL is reviewable and predictable — no query engine surprises
- `$inferSelect` / `$inferInsert` provide type inference without manual type definitions
- Migration files are human-readable SQL that can be audited before applying

This matters for an assessment platform where data integrity directly affects grades and academic records.

### JSONB for Flexible Content

**Trade-off:** Less queryable than normalized columns, but avoids schema explosion.

Questions, answers, and rubrics use JSONB columns for their content because each question type (MCQ, written, coding, UML) has fundamentally different data shapes:

- MCQ: `{ options: [...], correctAnswers: [...] }`
- Written: `{ modelAnswer: "..." }`
- UML: `{ referenceUml: "...", editorState: {...} }`
- Coding: `{ template: "...", testCases: [...] }`

Normalizing these into separate tables would require 4+ content tables with complex joins. JSONB keeps the schema manageable while PostgreSQL's JSONB operators still allow targeted queries when needed.

### Enums for State Machines

**Trade-off:** Database-level constraints vs. application-level validation.

`submission_status` (draft → submitted → late → grading → graded) and `ai_job_status` (pending → processing → completed → failed) are PostgreSQL enums rather than plain strings. This enforces valid states at the database level, preventing bugs where application code writes an invalid status.

The downside is that adding new enum values requires a migration, but state machine changes are infrequent and should be deliberate.

### Composite Unique Constraints

Key uniqueness rules enforced at the database level:

- `enrollments(userId, courseId)` — one enrollment per student per course
- `answers(submissionId, questionId)` — one answer per question per submission
- `assignmentQuestions(assignmentId, questionId)` — no duplicate questions in an assignment

These prevent data corruption from race conditions or double-submissions, which is critical during timed exams.

### Cost Tracking as String

`aiGradingJobs.cost` is stored as a string (not float) to avoid floating-point precision issues. LLM token costs are fractions of a cent — accumulating floats leads to rounding drift over thousands of grading jobs. The application converts to numbers for display only.

## How This Helps the Platform

The database schema is the backbone of the assessment workflow. By enforcing integrity constraints (enums, unique indexes, foreign keys) at the database level rather than relying solely on application code, the platform prevents grade corruption, duplicate submissions, and orphaned records — failures that would directly impact students and staff trust in the system.
