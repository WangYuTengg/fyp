# Manual Grading UX (Side-by-Side)

## Goal
Support high-volume manual grading (hundreds of submissions) with fewer clicks, less scrolling, and faster keyboard-first marking.

## What Changed

### 1) Side-by-side workspace
- **Left pane**: searchable submission list with quick jump.
- **Right pane**: grading workspace for the selected student.
- **Inside the workspace**: active question answer and marking controls are shown side-by-side.

Rationale:
- Keeps navigation and grading context visible at the same time.
- Reduces context switching and page movement.

### 2) Question-by-question grading flow
- Only one active question is displayed at a time.
- A question navigator allows direct switching between questions.
- The selected question stays consistent while moving to next/previous student.

Rationale:
- Enables “grade Q1 for everyone, then Q2” workflow.
- Improves consistency and grading speed across many submissions.

### 3) Low-click student navigation
- Search by student name/email.
- Jump directly to a submission position (`Jump to #`).
- Previous/Next student buttons in workspace.
- Optional `Save and Next Student` action.

Rationale:
- Fast movement through long submission queues.
- Fewer pointer interactions for repetitive marking tasks.

### 4) Keyboard-first interactions
- Auto-focus marks input on student/question change.
- Input is auto-selected so grader can type immediately.
- Shortcuts:
  - `[` and `]` to move between questions.
  - `J` and `K` to move to next/previous student.

Rationale:
- Removes repeated clicks into mark input.
- Enables rapid grading with minimal hand movement.

### 5) Visibility and progress cues
- Submission list shows total, graded, and remaining counts.
- Question tabs show per-question score at a glance.
- Total score is visible in the workspace header.

Rationale:
- Keeps grader aware of progress and coverage.
- Reduces mental load during long grading sessions.

## Technical Notes
- Manual grading payload now sends `answerId`, `points`, `maxPoints`, and `feedback` for compatibility with the current grading API.
- Existing marks are loaded by `answerId` so previously graded submissions show the correct values.
