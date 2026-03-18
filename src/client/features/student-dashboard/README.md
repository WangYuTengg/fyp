# Student Dashboard

Displays enrolled courses in a grid view for the currently authenticated student.

## Design Decisions

### Simple Fetch + Grid Rendering

**Trade-off:** No client-side search/filter, but minimal complexity for a straightforward view.

The dashboard fetches all enrolled courses in a single API call and renders them as cards. There's no local filtering or search because students typically enroll in 4-6 courses per semester — pagination and search would be over-engineering.

### TanStack Query for Data Fetching

**Trade-off:** Added dependency vs. manual `useEffect` + `useState`.

Even for this simple view, TanStack Query provides automatic cache invalidation when navigating back from a course detail page, and prevents duplicate requests when the component remounts. The alternative would require manual cache management that's easy to get wrong.

## How This Helps the Platform

This is the student's landing page after login. A fast, reliable course listing builds confidence in the platform from the first interaction — if students see stale data or loading spinners here, they'll distrust the system during exams.
