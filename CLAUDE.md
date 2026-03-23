# UML Assessment Platform (FYP)

Automated assessment platform for educational institutions — supports MCQ, written, coding, and UML diagram assignments with LLM-assisted grading. Designed for on-premise school deployment.

## Tech Stack

- **Frontend**: Vite 7 + React 19 + TypeScript + TanStack Router (file-based) + TanStack Query + Tailwind CSS 4 + Headless UI
- **Backend**: Hono + Node.js + TypeScript
- **Auth**: Supabase (email/password + magic links) + custom JWT
- **Database**: PostgreSQL + Drizzle ORM
- **Background Jobs**: Graphile Worker (concurrency=1)
- **LLM**: Vercel AI SDK 6 → OpenAI (GPT-4o) or Anthropic (Claude 3.5 Sonnet), configurable per institution
- **DevOps**: Docker + GitHub Actions → ghcr.io

## Commands

```bash
# Development
npm run dev              # Both client (:5173) + server (:3000)
npm run dev:client       # Vite dev server only
npm run dev:server       # Hono with tsx watch only

# Build
npm run build            # Both client + server
npm run build:client     # Client only
npm run build:server     # Server only

# Database
npm run db:generate      # Generate migration from schema changes
npm run db:migrate       # Apply migrations
npm run db:studio        # Open Drizzle Studio
npm run db:seed-passwords # Seed test user passwords

# Lint
npm run lint             # ESLint (no auto-fix)

# Docker
docker-compose up --build
```

## Architecture

```
src/
├── client/                          # React SPA
│   ├── routes/                      # TanStack Router file-based routing
│   │   ├── __root.tsx               # Root layout with Sidebar
│   │   ├── student/                 # Student: courses, assignments, submissions
│   │   └── staff/                   # Staff: courses, grading, analytics, settings
│   ├── features/                    # Feature modules (hooks, components, types per feature)
│   │   ├── student-dashboard/
│   │   ├── student-assignment/      # Assignment attempt, timer, focus monitor, auto-save
│   │   ├── student-course/
│   │   ├── student-submission/      # Submission review
│   │   ├── staff-dashboard/
│   │   ├── staff-course/            # Course management + question pool + assignment builder
│   │   ├── staff-grading/           # Grading dashboard + AI review
│   │   ├── staff-settings/          # LLM configuration
│   │   ├── staff-notifications/     # Grading job notifications
│   │   └── admin-users/             # User management
│   ├── components/                  # Shared (Modal, Sidebar, ErrorBoundary, UMLEditor, UMLViewer, UserInfo)
│   ├── contexts/AuthContext.tsx      # Auth state + DB user roles
│   └── lib/api.ts                   # API client with auto Bearer token injection
│
├── server/
│   ├── routes/                      # Hono route handlers (subdirectories per resource)
│   ├── jobs/                        # Graphile Worker tasks
│   │   ├── auto-grade-written.ts    # LLM grading for essays
│   │   ├── auto-grade-uml.ts       # Vision API for UML diagrams
│   │   └── auto-submit-expired.ts   # Cron: auto-submit expired drafts
│   ├── middleware/auth.ts           # JWT validation + RBAC (dual: custom JWT + Supabase JWT)
│   ├── lib/ai.ts                    # LLM provider factory (OpenAI or Anthropic)
│   ├── config/prompts.ts            # LLM prompt templates
│   └── config/pricing.ts            # Token cost calculation per provider/model
│
├── db/
│   ├── schema.ts                    # 16 tables with Drizzle ORM
│   └── migrations/                  # Auto-generated SQL
│
└── docs/
    ├── agents/                      # Detailed convention docs for agents/AI assistants
    │   ├── architecture.md          # Folder organization, client/server separation
    │   ├── api-design.md            # Hono routes, middleware, error responses
    │   ├── auth.md                  # Auth flow, middleware, session handling
    │   ├── database.md              # Drizzle schema, migrations, queries
    │   ├── frontend.md              # React components, routing, state management
    │   ├── style.md                 # Code style conventions
    │   └── typescript-conventions.md # Type safety, naming, patterns
    └── DEPLOYMENT.md                # Production deployment guide
```

## Key Patterns

### Roles & Access
- **Global roles**: admin, staff, student
- **Course-scoped roles** (enrollments table): lecturer, ta, lab_exec, student
- Server: `authMiddleware` validates JWT → `requireRole(...)` checks permissions
- Client: `beforeLoad` route guards via TanStack Router

### API Design
- Response format: `{ success: true/false, data: {...}, error?: "message" }`
- Status codes: 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Error
- Rate limiting: 1000 req/15min per IP
- Auth: `Authorization: Bearer <token>` header — middleware accepts both custom JWT and Supabase JWT

### Database
- Schema-first with Drizzle ORM — modify `src/db/schema.ts` → `npm run db:generate` → `npm run db:migrate`
- JSONB fields for flexible content (MCQ options, rubrics, code templates, UML data)
- Enums: `user_role`, `course_role`, `assignment_type`, `submission_status` (draft→submitted→late→grading→graded), `ai_job_status`, `notification_type`
- Indexes on: course_id, user_id, assignment_id
- All tables have `created_at` + `updated_at` — update `updated_at` manually in `.set()`

### LLM Grading
- `getModel()` factory returns OpenAI or Anthropic based on `systemSettings`
- Structured output via Zod schemas for parsing LLM JSON responses
- 60s timeout per LLM call
- Token usage + cost tracked in `aiGradingJobs` and aggregated daily in `aiUsageStats`
- Notifications sent to staff on grading completion/failure

### Frontend State
- **Auth**: React Context (`AuthContext.tsx`) with DB user roles
- **Server state**: TanStack Query (5-min stale time, no refetch on focus)
- **Local state**: Custom hooks per feature (useAssignmentData, useAnswerManagement, etc.)
- **API calls**: `apiClient()` auto-injects Bearer token from localStorage or Supabase session

## Conventions

- **Types**: Use `type` over `interface`. Define feature-specific types in `types.ts` within that feature directory
- **Files**: `kebab-case.ts`, components `PascalCase.tsx`, constants `UPPER_SNAKE_CASE`
- **No `any`**: Use `unknown` + type guards. Leverage Drizzle's `$inferSelect` / `$inferInsert`
- **Functional style**: Prefer `const`, immutability, array methods over imperative loops
- **Feature-based structure**: Each feature has its own hooks/, components/, types.ts
- **Error handling**: Try/catch with user-friendly messages. Errors typed as `unknown`, then narrowed
- **Consistency over preference**: Match existing patterns when adding new features
- **Documentation**: When adding a new feature, subfolder, or making a significant architectural decision, add or update the relevant `README.md` in that folder. Each README must explain:
  - **Trade-offs made** — what was chosen, what was rejected, and why
  - **Why the decision was taken** — the constraint or goal that drove the choice
  - **How it helps the platform** — how the decision serves the assessment platform's goals
  - Follow the format used in existing READMEs (see any `src/*/README.md` for examples)

## Environment

See `.env.example`. Key variables:
- `DATABASE_URL` — PostgreSQL connection
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase auth
- `VITE_APP_URL` — frontend URL (default `http://localhost:5173`)
- `PORT` — server port (default 3000)
- `OPENAI_API_KEY` / Anthropic key — LLM grading
