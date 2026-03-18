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

### CSRF Protection (S5)

**Decision:** CSRF protection is **not required** for this application.

All state-changing endpoints (POST/PUT/PATCH/DELETE) authenticate via the `Authorization: Bearer <token>` header. Browsers do not automatically attach custom headers to cross-origin requests, which means CSRF attacks cannot forge authenticated requests — the attacker would need to know the user's JWT.

Evidence:
- No `Set-Cookie` headers are sent by the server for auth
- No `credentials: 'include'` in the client's `apiClient()`
- Supabase session tokens are used client-side only and passed via `Authorization` header
- CORS (S4) further restricts which origins can make API requests

If cookie-based auth is ever introduced (e.g., httpOnly JWT cookies), CSRF protection via double-submit cookie or `SameSite=Strict` must be added simultaneously.

### Token Storage (S6)

**Decision:** Keep JWTs in `localStorage` (Option A from S6 ticket).

**Trade-off:** Vulnerable to XSS, but acceptable for an internal school tool with strong CSP.

`localStorage` is accessible to any JavaScript running on the page, so an XSS vulnerability could steal the token. However:
- CSP headers (S3) block inline scripts and restrict script sources, significantly reducing the XSS attack surface
- `httpOnly` cookies would require CSRF protection (adding complexity) and complicate the dual-auth system
- The operational simplicity of localStorage is valuable for on-premise school deployments
- JWT expiry is now 24h (S9), limiting the damage window of a stolen token

**Migration path:** If security requirements increase, move to `httpOnly` cookies set by the server on login. This requires: updating `password-login.ts` to set `Set-Cookie`, updating `apiClient` to use `credentials: 'include'`, and adding CSRF protection (S5 becomes mandatory).

## How This Helps the Platform

Auth middleware is the security boundary — every API request passes through it. Dual JWT support ensures the platform works in any deployment environment, and automatic role inference reduces administrative setup to zero for new users.
