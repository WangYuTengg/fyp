# Staff Course Management

Comprehensive course management with tabbed interface — assignments, question pool, roster, auto-grading, and settings.

## Design Decisions

### Tabbed Interface (5 Tabs)

**Trade-off:** All functionality on one page vs. separate pages per concern.

Assignments, Questions, Roster, Auto-Grading, and Settings are tabs within a single course detail view rather than separate routes. This avoids repeated page loads and keeps the course context visible at all times. The downside is a larger component tree, but each tab lazy-loads its data via TanStack Query so the initial load only fetches the active tab's data.

### Reusable Question Pool

**Trade-off:** More complex question management vs. assignment-scoped questions.

Questions belong to a *course*, not an individual assignment. They can be reused across multiple assignments via the assignment-question junction table. This adds complexity (a separate "Questions" tab, tag management, search/filter) but prevents duplication — a common MCQ might appear in both a midterm and a final exam.

The alternative (questions scoped to assignments) would be simpler but force staff to recreate questions every time.

### Client-Side Question Filtering

**Trade-off:** Doesn't scale to 10,000+ questions, but avoids server-side search complexity.

The question pool filters (search text, tags, question type) run client-side after fetching all questions for a course. This is fast for typical course sizes (50-200 questions) and avoids building server-side full-text search. If a course exceeds ~500 questions, this approach would need to be replaced with server-side filtering.

### Bulk Enrollment via CSV/Email List

**Trade-off:** Less validation upfront, but faster for large classes.

Staff can enroll students by pasting a list of emails or uploading a CSV. The server processes these in bulk and returns a summary of successes/failures. Emails that don't match existing accounts are skipped (not auto-created) to prevent accidental account creation.

### Tag-Based Question Organization

**Trade-off:** Flat tags vs. hierarchical categories.

Questions are tagged with free-form strings rather than organized into a category hierarchy. Tags are more flexible (a question can have multiple tags like "week-3", "inheritance", "exam") and don't require staff to maintain a taxonomy. The trade-off is less structure, but for course-scoped question pools, flat tags provide sufficient organization.

## How This Helps the Platform

This is where staff spend most of their time — creating content, managing students, and configuring assessments. The tabbed layout keeps everything accessible without deep navigation, and the reusable question pool reduces repetitive work across semesters.
