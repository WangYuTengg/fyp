# Server — Hono API

REST API server built with Hono, running on Node.js with TypeScript.

## Architecture Decisions

### Resource-Based Route Files

**Trade-off:** Many small files vs. one large router.

Each resource (courses, assignments, submissions, etc.) has its own route file under `routes/`. This keeps individual files manageable (100-300 lines) and makes it easy to find the handler for any endpoint. The alternative — a single monolithic router — becomes unreadable past ~500 lines.

### Dual Auth Middleware

**Trade-off:** Added complexity for deployment flexibility.

The auth middleware accepts both custom JWTs (password-based login) and Supabase JWTs. Custom tokens are checked first (local database lookup, no network call) and Supabase is the fallback (requires network call to validate).

This exists because the platform targets on-premise school deployments where internet connectivity may be unreliable. Schools can run fully offline with custom JWT auth, or use Supabase for cloud deployments with magic link support.

### Email-Based Role Inference

**Trade-off:** Less flexible than a full RBAC system, but simpler for the school context.

Roles are inferred from email domain patterns (`@e.ntu.edu.sg` = student, `@staff.main.ntu.edu.sg` = staff). This avoids the need for a separate admin panel to assign roles — new users are automatically categorized when they first log in.

The limitation is that this only works for institutions with predictable email patterns. A hardcoded admin override exists for the platform administrator.

### Standardized Response Format

All endpoints return `{ success: true/false, data: {...}, error?: "message" }`. This was chosen over varying response shapes because:

- The client can have a single error handling path
- API consumers always know where to find the data
- Error messages are human-readable strings, not error codes that need mapping

## Subfolders

- **`routes/`** — One file per resource (~15 files), aggregated by Hono route groups
- **`jobs/`** — Graphile Worker background tasks (LLM grading)
- **`middleware/`** — Auth validation, RBAC, rate limiting
- **`lib/`** — LLM provider factory, notifications, file storage, worker setup
- **`config/`** — Prompt templates, pricing tables, constants
