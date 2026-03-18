# Student Assignment Attempt

Full assignment-taking interface — multi-question navigation, answer management, auto-save detection, timer, and submission workflow.

## Design Decisions

### Ref-Based Dirty Tracking

**Trade-off:** More manual than a form library, but avoids unnecessary re-renders.

Answer changes are tracked via `useRef` instead of state to avoid re-rendering the entire question list on every keystroke. A `beforeunload` handler warns students about unsaved work. The downside is that refs don't trigger React updates, so the "unsaved changes" indicator requires manual synchronization — but this is acceptable given the performance benefit for large assignments (20+ questions).

### Per-Question Save (Not Whole-Form Submit)

**Trade-off:** More API calls, but prevents data loss.

Each answer is saved individually to the server rather than submitting the entire assignment at once. This means a network failure only loses the current question's changes, not the entire attempt. For timed exams where students may lose connectivity, this is critical.

The trade-off is more HTTP requests, but each save is a small payload and the server handles them efficiently.

### Client-Side Question Navigation

**Trade-off:** All questions loaded upfront (larger initial payload) vs. pagination.

All questions are fetched when the assignment loads rather than paginated. This allows instant navigation between questions without loading spinners — important for timed exams where every second counts. The payload is manageable because question content is text-based (not media-heavy).

### Separate Hooks for Data vs. Answer Management

`useAssignmentData` handles fetching, `useAnswerManagement` handles state mutations. This separation exists because the data-fetching logic is read-only and cacheable, while answer management involves complex write logic (dirty tracking, debounced saves, submission validation). Combining them would create an unmaintainable super-hook.

### File Upload for UML Diagrams

**Trade-off:** File-based submission vs. inline editor only.

Students can upload diagram files in addition to using the built-in UML editor. This accommodates students who prefer external tools (draw.io, Lucidchart, hand-drawn scans) and serves as a fallback if the visual editor has issues. File version history is tracked so students can see their upload progression.

## How This Helps the Platform

This is the highest-stakes view in the platform — students take exams here. Reliability (auto-save, dirty tracking, beforeunload warnings) and performance (instant navigation, no loading spinners) directly impact the assessment experience. A crash or data loss during an exam undermines the entire platform's credibility.
