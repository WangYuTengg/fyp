# Staff Notifications

Notification center for staff — shows grading job results, batch completions, and failures with timestamps.

## Design Decisions

### Server-Generated Notifications (Not Real-Time)

**Trade-off:** Notifications are polled, not pushed via WebSockets.

Notifications are created server-side when grading jobs complete or fail, and fetched by the client on page load or manual refresh. WebSocket-based real-time push was considered but rejected because:

- Grading jobs take 5-60 seconds — polling on a 30-second interval is sufficient
- WebSockets add infrastructure complexity (connection management, reconnection logic)
- The notification center is not a primary workflow — staff don't stare at it

### Notification Types as Enum

**Trade-off:** Rigid set of notification types vs. free-form messages.

Notification types (`grading_failed`, `grading_completed`, `batch_completed`) are a PostgreSQL enum rather than free-form strings. This constrains the system but ensures the client can render type-specific UI (error styling for failures, success for completions) without guessing.

### Mark-Read (Single + Bulk)

Staff can mark individual notifications as read or clear all at once. The bulk "mark all read" exists because grading batches can generate dozens of notifications — marking them one-by-one would be tedious.

## How This Helps the Platform

Staff trigger AI grading and move on to other work. Notifications close the feedback loop — they know when grading finished (or failed) without repeatedly checking the grading dashboard. Failure notifications with error details help diagnose LLM issues quickly.
