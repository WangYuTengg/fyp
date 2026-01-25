# Architecture & Project Structure

## Folder Organization

```
src/
├── client/          # Frontend code (React + TanStack Router)
│   ├── routes/      # File-based routing
│   ├── components/  # Reusable UI components
│   ├── contexts/    # React contexts (auth, etc.)
│   ├── hooks/       # Custom React hooks
│   └── lib/         # Client utilities (api.ts, route-guards.ts)
├── server/          # Backend code (Hono API)
│   ├── routes/      # API route handlers
│   ├── middleware/  # Auth, CORS, error handling
│   └── lib/         # Server utilities (supabase.ts)
├── db/              # Database layer
│   ├── schema.ts    # Drizzle schema definitions
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

API routes in `src/server/routes/`:
- `/api/auth/*` - Authentication endpoints
- `/api/courses/*` - Course CRUD
- `/api/assignments/*` - Assignment CRUD
- `/api/submissions/*` - Submission handling
- `/api/questions/*` - Question management

**Middleware**: All routes except `/api/auth/*` require authentication via `src/server/middleware/auth.ts`

## Database Schema Patterns

See [database.md](database.md) for detailed schema conventions.

Key tables:
- `users` - Extended user profiles (synced with Supabase auth)
- `courses` - Course definitions
- `enrollments` - Student-course relationships with role-based access
- `assignments` - Assignment configurations (MCQ, written, coding, UML)
- `questions` - Question bank linked to assignments
- `submissions` - Student submission records
- `answers` - Individual question answers within submissions

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

1. User logs in via Supabase (email/password or magic link)
2. Supabase creates session (stored in localStorage)
3. Client sends session token in `Authorization: Bearer <token>` header
4. Server middleware validates token with Supabase
5. User data attached to Hono context: `c.get('user')`

See [auth.md](auth.md) for detailed auth patterns.
