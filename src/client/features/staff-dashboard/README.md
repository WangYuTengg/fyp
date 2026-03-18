# Staff Dashboard

Course management hub for lecturers, TAs, and lab executives — list courses, create new ones, and navigate to course details.

## Design Decisions

### Modal-Based Course Creation

**Trade-off:** Less space for form fields, but avoids page navigation.

New courses are created via a modal dialog rather than a dedicated page. This keeps the staff member on the dashboard — they can see their existing courses while filling out the form. For a form with only 5-6 fields (code, name, description, academic year, semester), a modal provides sufficient space.

### Immediate Refresh on Create

**Trade-off:** Extra API call vs. optimistic update.

After creating a course, the dashboard refetches the course list from the server rather than optimistically inserting the new course into the cache. This guarantees data consistency (the server may modify fields like `id` or `createdAt`) at the cost of a brief loading flash. For a non-real-time dashboard, this is acceptable.

## How This Helps the Platform

Staff need a quick way to see all their courses and create new ones without navigating through multiple pages. The dashboard minimizes clicks to get to any course's detail view.
