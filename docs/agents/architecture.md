# Architecture & Project Structure

## Folder Organization

```
src/
├── client/          # Frontend code (React + TanStack Router)
│   ├── routes/      # File-based routing
│   ├── features/    # Feature modules (hooks, components, types per feature)
│   ├── components/  # Reusable UI components
│   ├── contexts/    # React contexts (auth)
│   └── lib/         # Client utilities (api.ts)
├── server/          # Backend code (Hono API)
│   ├── routes/      # API route handlers (subdirectories per resource)
│   ├── middleware/  # Auth, RLS
│   ├── jobs/        # Graphile Worker tasks (LLM grading, auto-submit)
│   ├── lib/         # Server utilities (ai.ts, notifications.ts, etc.)
│   └── config/      # Prompts, pricing, constants, env validation
├── db/              # Database layer
│   ├── schema.ts    # Drizzle schema definitions (16 tables)
│   ├── index.ts     # Database client
│   └── migrations/  # Auto-generated SQL migrations
└── lib/             # Shared utilities
    └── supabase.ts  # Supabase client config
```

## Client/Server Separation

- **Client code** (`src/client/`): Runs in browser, uses Vite, imports from `src/lib/supabase.ts`
- **Server code** (`src/server/`): Runs on Node.js, uses Hono, imports from `src/server/lib/supabase.ts`
- **Shared code** (`src/db/`, `src/lib/`): Can be imported by both

## Routing Patterns

### Frontend Routes (TanStack Router)

File-based routing in `src/client/routes/`:
- `__root.tsx` - Root layout with Sidebar
- `index.tsx` - Home/dashboard
- `login.tsx` - Authentication page
- `student.tsx` - Student layout (requires student role)
- `staff.tsx` - Staff layout (requires staff role)
- `student/courses/$courseId.tsx` - Course detail page
- `staff/assignments/$assignmentId.tsx` - Assignment detail page

**Route Guards**: Use `beforeLoad` with `requireAuth` or `requireRole` from `src/client/lib/route-guards.ts`

### Backend Routes (Hono)

API routes in `src/server/routes/` organized as subdirectories per resource:
- `/api/auth/*` - Authentication (signin, signup, magic link, password reset, refresh)
- `/api/courses/*` - Course CRUD, enrollments, bulk enroll, grade export
- `/api/assignments/*` - Assignment CRUD, publish, analytics, clone, question management
- `/api/submissions/*` - Start, save, submit, grade, focus events
- `/api/questions/*` - Question CRUD, import/export
- `/api/auto-grade/*` - Batch/single AI grading, queue, accept/reject, stats
- `/api/admin/*` - User CRUD, bulk create, password reset
- `/api/settings/*` - LLM provider configuration
- `/api/notifications/*` - List, mark read, unread count
- `/api/tags/*` - Tag management
- `/api/users/*` - User lookup

**Middleware**: All routes except public auth endpoints require authentication via `src/server/middleware/auth.ts`

## Database Schema Patterns

See [database.md](database.md) for detailed schema conventions.

16 tables — see [database.md](database.md) for full details. Key ones:
- `users`, `passwordResetTokens`, `refreshTokens` - Auth & user management
- `courses`, `enrollments` - Course structure with course-scoped roles
- `assignments`, `assignmentQuestions`, `questions` - Assessment content
- `submissions`, `answers`, `marks` - Student work & grading
- `rubrics` - Rubric criteria per question
- `aiGradingJobs`, `aiUsageStats` - LLM grading pipeline
- `staffNotifications`, `systemSettings` - Platform infrastructure

## Role-Based Access Control

Three user roles:
1. **admin** - Platform administrators
2. **staff** - Lecturers/instructors
3. **student** - Students

Course-scoped roles (in `enrollments` table):
- **lecturer** - Course creator/owner
- **ta** - Teaching assistant
- **lab_exec** - Lab executive
- **student** - Enrolled student

## API Response Patterns

Standard responses:
```typescript
// Success
{ success: true, data: {...} }

// Error
{ success: false, error: "Error message" }

// List with pagination (future)
{ success: true, data: [...], pagination: {...} }
```

## Error Handling

- Frontend: Try/catch with user-friendly messages
- Backend: Middleware catches errors, returns JSON with status codes
- Database: Use Drizzle's error handling, convert to API errors

## Authentication Flow

Dual authentication — custom JWT (fast, on-premise) + Supabase JWT (cloud, magic links):

1. User logs in via custom password auth or Supabase magic link
2. Server issues custom JWT (HS256) or Supabase provides session token
3. Client sends token in `Authorization: Bearer <token>` header
4. Server middleware tries custom JWT first (no network call), falls back to Supabase verification
5. User data attached to Hono context: `c.get('user')`
6. Token refresh with rotation via `refreshTokens` table

See [auth.md](auth.md) for detailed auth patterns.
