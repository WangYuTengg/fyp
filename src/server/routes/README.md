# API Routes

Resource-based Hono route handlers — organized as subdirectories per resource.

## Design Decisions

### One File Per Resource

**Trade-off:** Many small files vs. fewer large files.

Each resource (courses, assignments, submissions, questions, etc.) has its own route file. This keeps individual files manageable (100-300 lines) and makes it easy to find the handler for any endpoint by resource name. The alternative — a single monolithic router — becomes unreadable past ~500 lines.

### Subdirectory-Per-Resource Structure

**Trade-off:** More directories, but each handler file stays small and focused.

Routes are organized into subdirectories by resource (e.g., `routes/courses/`, `routes/submissions/`). Each subdirectory contains individual handler files for specific operations. This keeps files small and makes it easy to find any endpoint. The index file in each subdirectory composes the handlers into a single router.

### Zod Validation at the Boundary

**Trade-off:** Parsing overhead on every request, but guarantees type safety inside handlers.

All request bodies and query parameters are validated with Zod schemas at the route level. If validation fails, a 400 response is returned before the handler logic runs. This means handlers can trust their inputs are correctly typed without defensive checks.

### Consistent Error Response Format

All routes return `{ success: false, error: "message" }` for errors, using appropriate HTTP status codes. Error messages are user-friendly strings — internal details (stack traces, SQL errors) are logged server-side but never exposed to clients.

## How This Helps the Platform

A predictable API structure (one file per resource, consistent response format, validated inputs) makes the platform maintainable as more resources are added. New developers can add endpoints by following existing patterns without understanding the entire codebase.
