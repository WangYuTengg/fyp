# Middleware

JWT validation, role-based access control, and rate limiting.

## Design Decisions

### Dual JWT Validation (Custom First, Supabase Fallback)

**Trade-off:** Two code paths for auth, but supports both on-premise and cloud deployments.

The auth middleware checks for a custom JWT (signed with `JWT_SECRET`, validated locally) before falling back to Supabase JWT (requires a network call to verify). Custom tokens are checked first because:

- Local validation is faster (no network latency)
- On-premise deployments may not have internet access for Supabase
- If both tokens are present (edge case during migration), the local token takes priority

### Email-Based Role Inference

**Trade-off:** Hardcoded email patterns, but automatic role assignment.

New users are assigned roles based on their email domain:
- `@e.ntu.edu.sg` → student
- `@staff.main.ntu.edu.sg` → staff
- Hardcoded email → admin

This avoids the need for a separate admin panel to assign roles on first login. The limitation is that it only works for NTU's email structure — other institutions would need to modify the patterns. A configurable role-mapping table would be more flexible but adds complexity that isn't needed for the current single-institution deployment.

### Auto-Create Users on First Supabase Login

**Trade-off:** Users are created in the local database without explicit registration.

When a Supabase-authenticated user hits the API for the first time, their record is automatically created in the `users` table with an inferred role. This eliminates a separate registration step — students and staff just log in with their institutional email and they're ready to go.

### Rate Limiting (1000 req/15min per IP)

**Trade-off:** May block legitimate heavy usage, but prevents abuse.

Rate limiting is applied globally at 1000 requests per 15-minute window per IP. This is generous enough for normal usage (a grading session might generate 200-300 requests) but prevents runaway clients or API abuse.

Rate limiting is skipped for monitoring endpoints in development to avoid interfering with health checks.

## How This Helps the Platform

Auth middleware is the security boundary — every API request passes through it. Dual JWT support ensures the platform works in any deployment environment, and automatic role inference reduces administrative setup to zero for new users.
