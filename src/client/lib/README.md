# Client Library

API client with auto-token injection, question type utilities, and route guards.

## Design Decisions

### Centralized API Client with Auto-Bearer Token

**Trade-off:** All API calls go through one function, adding a layer of indirection.

`apiClient()` wraps `fetch` to automatically inject the Bearer token from localStorage (custom JWT) or Supabase session. This was chosen over per-feature fetch calls because:

- Token injection logic is written once, not duplicated across 15+ features
- Error handling (401 → redirect to login) is centralized
- Switching auth methods doesn't require updating every API call

### Modular API Objects (coursesApi, submissionsApi, etc.)

**Trade-off:** More boilerplate than a generic CRUD helper, but explicit and discoverable.

API functions are organized into objects by resource (`coursesApi.list()`, `submissionsApi.saveAnswer()`). This was chosen over a generic `api.get('/courses')` because:

- IDE autocomplete shows available endpoints
- TypeScript catches endpoint typos at compile time
- Each function documents its parameters explicitly

### Untyped Response Bodies (`unknown`)

**Trade-off:** No compile-time response type safety, but avoids maintaining duplicate type definitions.

API responses are typed as `unknown` rather than generic `ApiResponse<T>`. The caller is responsible for casting. This was a pragmatic choice — maintaining typed response wrappers for 30+ endpoints would require either code generation or manual type definitions that drift from the server.

The server's response format (`{ success, data, error? }`) is consistent enough that runtime checks are simple.

### Separate File Upload Path

**Trade-off:** Two fetch patterns instead of one, but file uploads require different headers.

File uploads use `multipart/form-data` instead of JSON. Rather than adding content-type detection to `apiClient()`, a separate `uploadFile()` function handles the different content type. This keeps the common JSON path simple and avoids accidental header conflicts.

## How This Helps the Platform

A centralized API client ensures consistent auth handling, error responses, and request formatting across the entire frontend. When the auth system changes (e.g. adding a new token type), only this file needs updating.
