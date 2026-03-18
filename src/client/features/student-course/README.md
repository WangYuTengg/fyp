# Student Course Detail

Shows assignments within a course for the enrolled student, with status indicators and navigation to attempts.

## Design Decisions

### Admin View-As Support

**Trade-off:** Added conditional logic for a non-student role viewing student pages.

Admins can impersonate student/staff roles via `setAdminViewAs()` stored in localStorage. This means the student course view must handle an admin context — checking `effectiveRole` instead of the actual role. This adds complexity but is essential for debugging and support: admins need to see exactly what students see without creating test accounts.

### Flat Assignment List (No Grouping)

**Trade-off:** Less organized for courses with many assignments, but simpler and consistent.

Assignments are displayed as a flat list rather than grouped by type or due date. Grouping would add UI complexity (collapsible sections, group headers) for marginal benefit — most courses have 5-15 assignments. The list includes status badges (draft, submitted, graded) that provide enough at-a-glance information.

## How This Helps the Platform

This is the primary navigation point for students — from here they start assignments, check deadlines, and view graded work. Clear status indicators reduce confusion during assessment periods.
