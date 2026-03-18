# Student Submission View

Read-only view of a graded submission — shows student answers alongside grades, feedback, and AI suggestions.

## Design Decisions

### Read-Only Post-Submission View

**Trade-off:** Students cannot edit after submission, even if the deadline hasn't passed.

Once submitted, answers are locked. This is a deliberate academic integrity decision — allowing edits after submission (even before the deadline) creates ambiguity about what was graded. Students must start a new attempt if re-submission is allowed.

### AI Suggestion Visibility

**Trade-off:** Transparency vs. potential student gaming.

AI grading suggestions are shown to students alongside manual grades when available. This builds trust in the LLM grading system — students can see *why* they received a score. The risk is that students might reverse-engineer the grading criteria, but since rubrics are already shared (standard academic practice), this is acceptable.

## How This Helps the Platform

Transparent feedback closes the assessment loop. Students see not just their grade but the reasoning behind it, which supports learning outcomes — the primary goal of any assessment platform.
