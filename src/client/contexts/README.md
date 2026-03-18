# Auth Context

React Context for authentication state — manages Supabase sessions, custom JWT tokens, user roles, and admin impersonation.

## Design Decisions

### Dual Auth State (Custom JWT + Supabase)

**Trade-off:** More complex state management, but supports both deployment models.

The auth context checks for a custom JWT token (localStorage) before falling back to Supabase session. Custom tokens take priority because they don't require a network call to validate — important for on-premise deployments with unreliable internet.

This means the context must track two possible auth sources and unify them into a single `DbUser` object that the rest of the app consumes.

### DB User Fetched via `/api/auth/me`

**Trade-off:** Extra API call on load, but decouples auth from role management.

After authentication (Supabase or custom JWT), the context fetches the user's database record (including role) via `/api/auth/me`. This was chosen over embedding the role in the JWT because:

- Roles can change (e.g. a student becomes a TA) without re-issuing tokens
- The database is the source of truth for roles, not the auth provider
- Supabase doesn't store application-specific roles

### Admin View-As Mode

**Trade-off:** Added complexity for a debugging/support feature.

Admins can set `adminViewAs` (student or staff) in localStorage to impersonate a role. The `effectiveRole` computed property returns the view-as role instead of the actual admin role. This allows admins to test the student/staff experience without creating test accounts.

The trade-off is that every role check in the app must use `effectiveRole` (or `hasRole()` / `isStaff()` which account for it) instead of the raw user role.

### Context Over State Library

**Trade-off:** No devtools or middleware, but auth state is simple enough not to need them.

Auth state is a single object (user + role + loading flag) with a few methods (signOut, hasRole, setCustomToken). This doesn't warrant Redux/Zustand — React Context with `useContext` is sufficient and avoids an additional dependency.

## How This Helps the Platform

Authentication is the gateway to every feature. A reliable, unified auth context ensures that role-based access control works consistently across all routes and API calls, regardless of whether the deployment uses Supabase or custom JWT.
