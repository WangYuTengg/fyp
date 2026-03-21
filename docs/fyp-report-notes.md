# UML Assessment Platform — FYP Report Notes

## 1. Project Overview

The UML Assessment Platform is a web-based automated assessment system designed for educational institutions. It supports multiple question types — MCQ, written/essay, coding, and UML class diagram assignments — with LLM-assisted grading as its primary differentiator. The platform is designed for **on-premise school deployment**, addressing a real gap in existing assessment tools: no widely-adopted platform combines traditional assessment types with AI-powered grading of software engineering artefacts like UML diagrams.

**Problem Statement.** Grading UML diagrams and written answers at scale is a labour-intensive process. A class of 200 students submitting 5 written/UML questions each produces 1,000 items to grade — a task that takes lecturers 10+ hours manually. Existing platforms (Canvas, Moodle) handle MCQ auto-grading but offer no support for evaluating structural software artefacts like class diagrams.

**Solution.** The platform automates grading of written answers and UML diagrams using Large Language Models (GPT-4o, Claude 3.5 Sonnet) with structured output validation. Staff trigger batch grading, review AI suggestions, and approve/override marks — a human-in-the-loop workflow that balances automation with academic integrity.

**Scope.** The platform covers the full assessment lifecycle: course creation → question pool management → assignment configuration → student submission → auto-grading → manual review → grade publication → analytics.

**Key Statistics.**

| Metric | Value |
|--------|-------|
| Source files (TypeScript/TSX) | 254 |
| Lines of code | ~34,800 |
| Database tables | 15 |
| Database migrations | 12 |
| API route modules | 11 |
| Client route pages | 20 |
| Feature modules | 10 |

---

## 2. Main Features and User Workflows

### 2.1 Role-Based Access

The platform implements a two-tier role system:

- **Global roles** (system-wide): `admin`, `staff`, `student` — stored in the `users` table, inferred automatically from email domain patterns (e.g., `@e.ntu.edu.sg` → student, `@staff.main.ntu.edu.sg` → staff).
- **Course-scoped roles** (per course): `lecturer`, `ta`, `lab_exec`, `student` — stored in the `enrollments` table, allowing a staff member to be a lecturer in one course and a TA in another.

**Design Decision.** Roles are inferred from email domain rather than assigned through an admin panel. This eliminates onboarding friction — new users simply log in with their institutional email and are automatically categorised.

**Tradeoff.** This approach only works for institutions with predictable email patterns (e.g., NTU). Multi-institution deployment would require a configurable role-mapping table. A hardcoded admin override exists for platform administrators.

*Evidence: `src/server/middleware/auth.ts:26-44` (getRoleFromEmail function)*

### 2.2 Staff Workflows

#### Course Management
Staff create courses with metadata (code, name, academic year, semester) and manage them through a **tabbed interface** with five tabs: Assignments, Questions, Roster, Auto-Grading, and Settings.

**Design Decision.** All course management lives on a single page with tabs rather than separate routes. This avoids repeated page loads and keeps course context visible at all times.

**Tradeoff.** The component tree is larger, but each tab lazy-loads its data via TanStack Query, so only the active tab's data is fetched on initial load.

*Evidence: `src/client/features/staff-course/` (feature module with tabbed interface)*

#### Reusable Question Pool
Questions belong to a **course**, not to individual assignments. They can be reused across multiple assignments via a junction table (`assignmentQuestions`). Questions support tags for organisation, with free-form strings rather than hierarchical categories.

**Design Decision.** Course-level question pools prevent duplication — a common MCQ can appear in both a midterm and final exam.

**Tradeoff.** Client-side filtering is used for the question pool (search text, tags, question type). This is fast for typical course sizes (50-200 questions) but doesn't scale to 10,000+ questions. Server-side full-text search would be needed for larger pools.

*Evidence: `src/db/schema.ts:72-88` (questions table), `src/db/schema.ts:117-125` (assignmentQuestions junction table)*

#### Assignment Configuration
Assignments support rich configuration:
- Time limits, open/due dates, max attempts
- MCQ penalty per wrong selection (negative marking)
- Late submission penalties (none, fixed, per-day, per-hour) with configurable caps
- Question shuffling for exam integrity
- Focus monitoring (tab switch tracking) with configurable limits
- Attempt scoring method (latest vs. highest)
- Publish/unpublish controls for both the assignment and results

*Evidence: `src/db/schema.ts:91-114` (assignments table with all configuration columns)*

#### Bulk Enrollment
Staff enroll students by pasting email lists or uploading CSVs. The server processes these in bulk and returns a success/failure summary. Emails that don't match existing accounts are skipped to prevent accidental account creation.

*Evidence: `src/server/routes/admin/` (admin routes including bulk user operations)*

#### AI-Assisted Grading
Staff trigger batch auto-grading for written and UML questions. The system:
1. Enqueues one Graphile Worker job per answer
2. Each job calls the LLM with the student answer + model answer + rubric
3. LLM output is validated against a Zod schema (points, reasoning, confidence, per-criterion scores)
4. AI suggestions are stored on the answer record
5. Staff review suggestions in a side-by-side grading interface
6. Staff accept, modify, or reject each suggestion

*Evidence: `src/server/jobs/auto-grade-written.ts`, `src/server/jobs/auto-grade-uml.ts`*

#### Manual Grading UX
The grading interface uses a **side-by-side workspace** design optimised for high-volume grading:
- Left pane: searchable submission list with quick jump
- Right pane: grading workspace for the selected student
- Question-by-question navigation (grade Q1 for everyone, then Q2)
- Keyboard shortcuts: `[`/`]` for questions, `J`/`K` for students
- Auto-focus on marks input, auto-select for immediate typing
- Progress indicators (total, graded, remaining counts)

**Design Decision.** The "grade one question across all students" workflow was prioritised because it improves grading consistency — the lecturer evaluates the same criteria repeatedly rather than context-switching between different questions.

*Evidence: `src/client/features/staff-grading/README.md` (detailed UX documentation)*

### 2.3 Student Workflows

#### Assignment Attempt
Students navigate courses → assignments → start an attempt. The attempt interface provides:
- Multi-question navigation with instant switching (all questions loaded upfront)
- Per-question auto-save (individual answers saved to server, not whole-form submit)
- Dirty tracking via `useRef` (avoids re-renders on every keystroke)
- `beforeunload` warning for unsaved changes
- Timer for timed exams
- Tab switch detection for focus monitoring

**Design Decision.** Per-question save was chosen over whole-form submit because a network failure only loses the current question's changes, not the entire attempt. For timed exams with unreliable connectivity, this is critical.

**Tradeoff.** More HTTP requests, but each save is a small payload and the server handles them efficiently.

*Evidence: `src/client/features/student-assignment/README.md`*

#### UML Diagram Editor
The platform includes a custom UML editor with three modes:
- **Visual mode**: xyflow-based class diagram editor (drag-and-drop)
- **Text mode**: PlantUML syntax editing
- **Preview mode**: Rendered diagram preview

Bidirectional sync between visual and text modes ensures changes in one are reflected in the other. The editor exports both PlantUML text and JSON editor state, allowing structural comparison during grading.

**Design Decision.** Supporting multiple editing modes accommodates different student preferences — some prefer graphical editing, others prefer text-based PlantUML.

**Tradeoff.** Bidirectional sync is complex but necessary. The editor also supports file upload for students who prefer external tools (draw.io, Lucidchart, scanned hand-drawn diagrams).

*Evidence: `src/client/components/README.md` (UML Editor section)*

#### Submission & Feedback
After submission, answers are locked (read-only). AI grading suggestions are shown to students alongside manual grades when results are published. This transparency builds trust in the LLM grading system.

**Design Decision.** Post-submission lock is a deliberate academic integrity choice — no edits after submission, even before the deadline.

*Evidence: `src/client/features/student-submission/README.md`*

### 2.4 Admin Workflows

Admins have a **view-as mode** that allows impersonating student or staff roles. The `effectiveRole` property in the auth context returns the impersonated role, enabling admins to see exactly what students/staff see without creating test accounts.

*Evidence: `src/client/contexts/AuthContext.tsx` (admin view-as implementation)*

---

## 3. System Architecture

### 3.1 High-Level Architecture

The platform follows a **monolithic SPA + API server** architecture with a separate background worker:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                                │
│  React 19 SPA + TanStack Router + TanStack Query                      │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  Routes   │  │   Features   │  │  Components  │  │  AuthContext │  │
│  │ (guards)  │  │(hooks+views) │  │  (shared UI) │  │  (state)    │  │
│  └─────┬─────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │
│        └───────────┬────┴──────────────────┘                │         │
│                    │                                        │         │
│              apiClient() ───── Bearer Token injection ──────┘         │
└────────────────────┬──────────────────────────────────────────────────┘
                     │ HTTP/JSON
                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Server (Hono on Node.js)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │  Middleware   │  │    Routes    │  │    Config     │                │
│  │ (auth, CORS, │  │ (11 modules) │  │ (prompts,     │                │
│  │  rate limit,  │  │              │  │  pricing)     │                │
│  │  CSP, body)  │  │              │  │              │                │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘                │
│         │                 │                                           │
│         ▼                 ▼                                           │
│  ┌──────────────────────────────────┐  ┌──────────────────────────┐  │
│  │     Drizzle ORM (PostgreSQL)     │  │    Graphile Worker       │  │
│  │   Schema-first, typed queries    │  │  (job queue in Postgres) │  │
│  └──────────────┬───────────────────┘  └──────────┬───────────────┘  │
│                 │                                  │                   │
└─────────────────┼──────────────────────────────────┼───────────────────┘
                  │                                  │
                  ▼                                  ▼
         ┌───────────────┐                 ┌──────────────────┐
         │  PostgreSQL   │                 │  Standalone       │
         │  (Supabase/   │◄────────────────│  Worker Process   │
         │   Neon)       │                 │  (Graphile)       │
         └───────┬───────┘                 └────────┬──────────┘
                 │                                  │
                 │                                  ▼
                 │                         ┌──────────────────┐
                 │                         │  LLM APIs        │
                 │                         │  (OpenAI /       │
                 │                         │   Anthropic)     │
                 │                         └──────────────────┘
                 ▼
         ┌───────────────┐
         │  Supabase     │
         │  Auth          │
         └───────────────┘
```

### 3.2 Deployment Architecture (Kubernetes)

In production, the platform deploys as two Kubernetes workloads sharing a single Docker image:

| Component | K8s Resource | Replicas | Scaling |
|-----------|-------------|----------|---------|
| Web (Hono API + static SPA) | Deployment | 2-6 | HPA on CPU > 70% |
| Worker (Graphile) | Deployment | 1-3 | Manual |
| PostgreSQL | External (Supabase) | Managed | N/A |
| Auth | External (Supabase) | Managed | N/A |
| LLM | External (OpenAI/Anthropic) | SaaS | N/A |

**Design Decision.** Web and worker are separated into independent deployments so that long-running LLM calls (up to 60s) don't affect HTTP response times. They scale independently — web scales for exam traffic, worker scales for grading queue depth.

**Design Decision.** No in-cluster database. Supabase handles backups, scaling, monitoring, and connection pooling (Supavisor). This eliminates DBA overhead and is appropriate for a school deployment without dedicated database administrators.

**Tradeoff.** External database adds network latency vs. in-cluster DB, and requires internet connectivity from the cluster to Supabase. For fully air-gapped on-premise deployments, an in-cluster PostgreSQL instance would be needed.

*Evidence: `k8s/` (all Kubernetes manifests), `k8s/README.md` (deployment guide with architecture diagram)*

### 3.3 CI/CD Pipeline

```
Push to main → GitHub Actions:
  1. Test job: lint + vitest
  2. Build job: Docker image → ghcr.io (multi-stage build, GitHub Actions cache)
  3. Deploy job:
     a. Run database migrations (K8s Job with direct DB connection)
     b. Rolling update web + worker deployments (kubectl set image)
     c. Wait for rollout completion
```

**Design Decision.** Migrations run as a Kubernetes Job using the **direct** database connection (port 5432) because Drizzle's migrator uses prepared statements, which are incompatible with Supabase's transaction-mode connection pooler (port 6543).

**Design Decision.** Docker builds use GitHub Actions cache (`cache-from: type=gha`), and Vite env vars are injected as build args since they're embedded at build time.

*Evidence: `.github/workflows/build-deploy.yml`*

---

## 4. Tech Stack and Dependencies

### 4.1 Core Technologies

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Language** | TypeScript (strict) | 5.9 | End-to-end type safety |
| **Runtime** | Node.js | 20 | Server runtime (Alpine in Docker) |
| **HTTP Framework** | Hono | 4.11 | Lightweight server with middleware ecosystem |
| **Database** | PostgreSQL | Supabase-managed | Primary data store |
| **ORM** | Drizzle ORM | 0.45 | Schema-first, typed queries, SQL migrations |
| **Frontend Framework** | React | 19 | UI rendering |
| **Build Tool** | Vite | 7.2 | Fast dev server, optimised production builds |
| **Routing** | TanStack Router | 1.156 | File-based routing with type-safe params |
| **Server State** | TanStack Query | 5.90 | Cache management, auto-invalidation |
| **Styling** | Tailwind CSS | 4.1 | Utility-first CSS |
| **UI Primitives** | Headless UI | 2.2 | Accessible components (Modal, Dialog) |
| **Auth** | Supabase Auth | 2.91 | Email/password + magic links |
| **JWT** | jose | 6.2 | Custom JWT signing/verification |
| **Background Jobs** | Graphile Worker | 0.16 | PostgreSQL-based job queue |
| **AI SDK** | Vercel AI SDK | 6.0 | Unified LLM interface |
| **LLM Providers** | OpenAI / Anthropic | via AI SDK | GPT-4o, Claude 3.5 Sonnet |
| **Validation** | Zod | 4.3 | Runtime type validation |
| **Charts** | Recharts | 3.8 | Analytics visualisations |
| **UML Visual Editor** | xyflow | 12.10 | Drag-and-drop class diagram editor |
| **UML Text** | plantuml-encoder | 1.4 | PlantUML syntax encoding |
| **Email** | Nodemailer | 8.0 | Password reset, notifications |
| **Testing** | Vitest + Playwright | 4.1 / 1.58 | Unit/integration + E2E tests |
| **Container** | Docker (multi-stage) | Node 20 Alpine | Production image |
| **Orchestration** | Kubernetes | k3s recommended | On-premise deployment |

### 4.2 Key Dependency Choices

**Hono over Express.** Hono provides built-in TypeScript support, a middleware ecosystem (CORS, rate limiting, security headers, body limit, static serving), and better performance. Express would require numerous additional packages for the same middleware capabilities.

**Drizzle ORM over Prisma.** Drizzle generates reviewable SQL migrations and provides `$inferSelect`/`$inferInsert` for zero-maintenance type inference. Prisma's query engine abstraction was considered less appropriate for an assessment platform where data integrity is paramount — the ability to review generated SQL before applying migrations is a key advantage.

**TanStack Router over React Router.** File-based routing with type-safe route params and built-in `beforeLoad` guards for RBAC. Route guards are co-located with route definitions rather than scattered across wrapper components.

**Graphile Worker over BullMQ/Redis.** Uses PostgreSQL as the job queue, eliminating the need for a Redis instance. For a school deployment that already runs PostgreSQL, this means zero additional infrastructure. Jobs are transactional with the database, preventing split-brain issues between queue and data.

**Vercel AI SDK over direct OpenAI/Anthropic SDKs.** Provides a unified interface across LLM providers, enabling provider switching via configuration (no code changes). The `Output.object()` API with Zod schemas ensures structured, validated grading output.

---

## 5. Key Modules/Components

### 5.1 Server Modules

#### Auth Middleware (`src/server/middleware/auth.ts`)
Implements a **dual JWT validation** strategy: custom JWT is checked first (fast, local verification with `jose`), with Supabase as fallback (requires network call). This dual approach supports both on-premise offline deployments (custom JWT only) and cloud deployments (Supabase magic links).

On first Supabase login, users are auto-created in the local `users` table with an email-inferred role. Admin bypass allows the admin role for specific hardcoded emails.

Three middleware functions compose the auth chain:
- `authMiddleware` — attaches user to context (non-blocking)
- `requireAuth` — blocks unauthenticated requests
- `requireRole(...roles)` — blocks unauthorised roles (admins always pass)

#### LLM Provider Factory (`src/server/lib/ai.ts`)
Implements a **factory pattern with caching**: `getModel()` reads LLM settings (provider, model) from the `systemSettings` table and caches them with a 1-minute TTL. The factory returns either an OpenAI or Anthropic model instance via the Vercel AI SDK.

Three unified functions cover all LLM use cases:
- `generateAIText()` — free-form text completion
- `generateAIObject()` — structured JSON output with Zod validation
- `generateAIVision()` — image analysis (UML diagram grading)

Each function applies consistent error handling and token tracking. Cache invalidation (`clearLLMSettingsCache()`) is triggered when admin settings are updated.

**Design Decision.** The 1-minute cache TTL trades freshness for performance — grading jobs call `getModel()` for every question, and DB reads on every call would add unnecessary latency.

#### Background Jobs (`src/server/jobs/`)

**auto-grade-written.ts**: Grades written answers by sending the student answer + model answer + rubric to the LLM. The LLM response is validated against a Zod schema:
```typescript
const GradingResponseSchema = z.object({
  points: z.number().min(0),
  reasoning: z.string().min(10),
  confidence: z.number().min(0).max(100),
  criteriaScores: z.array(z.object({
    criterion: z.string(),
    score: z.number(),
    comment: z.string(),
  })).optional(),
});
```

**auto-grade-uml.ts**: Grades UML diagrams using either text comparison (PlantUML → PlantUML) or vision API (image → PlantUML extraction → comparison). Supports both student-drawn and editor-generated diagrams.

**auto-submit-expired.ts**: A cron task that auto-submits expired timed assignments, preventing students from exceeding time limits.

Each job follows the same lifecycle: `pending → processing → completed/failed`, with error tracking, token usage recording, cost calculation, and batch completion notification.

#### Prompt Templates (`src/server/config/prompts.ts`)
Prompts are **versioned TypeScript functions** (v1: balanced grading, v2: strict/technical grading) rather than database-stored strings. The active version is controlled by the `PROMPT_VERSION` environment variable.

**Design Decision.** Function-based prompts ensure they're version-controlled alongside the code that uses them. TypeScript enforces all required parameters are provided at compile time. Prompt changes are reviewed in the same PR as related code changes.

**Tradeoff.** Non-technical staff cannot edit prompts without code access. If prompt customisation becomes a requirement, they can be moved to the `systemSettings` table.

#### Pricing Configuration (`src/server/config/pricing.ts`)
Token costs are hardcoded per provider/model. This works offline (critical for on-premise deployments) and provider pricing changes are infrequent.

### 5.2 Client Modules

#### Auth Context (`src/client/contexts/AuthContext.tsx`)
Manages dual auth state (custom JWT + Supabase session). After authentication, fetches the user's database record via `/api/auth/me` to get the authoritative role.

**Design Decision.** Roles are fetched from the database on each session rather than embedded in the JWT, because roles can change (e.g., a student becomes a TA) without requiring token re-issuance.

The context also implements **admin view-as mode** — admins can impersonate student/staff roles via `effectiveRole`, which all role checks in the app must use.

#### API Client (`src/client/lib/api.ts`)
Centralised `apiClient()` wraps `fetch` with auto-Bearer token injection. API functions are organised into typed resource objects (`coursesApi`, `submissionsApi`, etc.) for IDE discoverability.

**Design Decision.** Response bodies are typed as `unknown` rather than generic `ApiResponse<T>`, avoiding the maintenance burden of 30+ typed response wrappers. The consistent server response format (`{ success, data, error? }`) makes runtime checks simple.

#### Feature Modules (`src/client/features/`)
Ten feature modules, each self-contained with its own components, hooks, and types:

| Module | Purpose |
|--------|---------|
| `staff-dashboard` | Course listing + creation |
| `staff-course` | Tabbed course management (5 tabs) |
| `staff-grading` | Side-by-side grading workspace |
| `staff-settings` | LLM configuration |
| `staff-notifications` | Grading job notifications |
| `student-dashboard` | Enrolled courses grid |
| `student-course` | Assignment listing with status |
| `student-assignment` | Assignment attempt (exam-taking) |
| `student-submission` | Read-only graded submission view |
| `staff-dashboard` | Analytics and dashboards |

**Design Decision.** Feature-based structure over flat `components/` + `hooks/`. Each feature is understandable in isolation; a developer working on grading doesn't navigate student submission code.

**Tradeoff.** Some code duplication (loading states, error handling) across features. This is intentional — premature abstraction across features with different data shapes leads to leaky abstractions.

#### Shared Components (`src/client/components/`)
- **Modal** — Headless UI Dialog with size variants (sm → screen)
- **Sidebar** — Role-aware navigation
- **UMLEditor** — Three-mode editor (visual/text/preview) with bidirectional sync
- **ErrorBoundary** — React error boundary with fallback UI
- **FileUpload** — Drag-and-drop with progress tracking

**Design Decision.** Headless UI for accessible primitives (focus trapping, escape key, screen reader support) with full Tailwind styling control. Chosen over pre-styled libraries (Material UI) because the platform needs a clean, functional appearance, not a branded design system.

---

## 6. Database/API Design

### 6.1 Database Schema

The database contains **15 tables** organised around the core entities of the assessment workflow:

```
users ─────┬──── enrollments ──── courses
           │                        │
           │                    assignments ──── assignmentQuestions ──── questions
           │                        │                                      │
           │                    submissions ──── answers ─────────── aiGradingJobs
           │                        │              │
           │                      marks ───────────┘
           │
           ├──── passwordResetTokens
           ├──── refreshTokens
           └──── staffNotifications

systemSettings (key-value store)
aiUsageStats (daily aggregates)
rubrics (per-question grading criteria)
```

**Key Tables:**

| Table | Purpose | Key Design Choice |
|-------|---------|-------------------|
| `users` | All platform users | Email-inferred role, optional Supabase ID, soft-delete via `deactivatedAt` |
| `enrollments` | Course membership | Composite unique on `(userId, courseId)`, course-scoped role |
| `questions` | Reusable question pool | JSONB `content` + `rubric` columns for polymorphic question types |
| `assignments` | Assessment configuration | Rich config: time limits, penalties, shuffling, focus monitoring |
| `submissions` | Student attempts | State machine via `submission_status` enum, tab switch tracking in JSONB |
| `answers` | Individual answers | JSONB `content`, composite unique on `(submissionId, questionId)` |
| `marks` | Grades per answer | Tracks `isAiAssisted`, `aiSuggestionAccepted`, `overrideReason` for audit trail |
| `aiGradingJobs` | LLM job tracking | Status, tokens, cost (as string for precision), batch grouping |
| `aiUsageStats` | Daily cost aggregates | Unique on `(date, provider, model)` |
| `systemSettings` | Key-value config | LLM provider, model, API key |

### 6.2 Key Schema Decisions

**JSONB for polymorphic content.** Questions, answers, and rubrics use JSONB columns because each question type has fundamentally different data shapes:
- MCQ: `{ options: [...], correctAnswers: [...] }`
- Written: `{ modelAnswer: "..." }`
- UML: `{ referenceUml: "...", editorState: {...} }`
- Coding: `{ template: "...", testCases: [...] }`

Normalising into separate tables would require 4+ content tables with complex joins. JSONB keeps the schema manageable while PostgreSQL's JSONB operators allow targeted queries when needed.

**Enums for state machines.** `submission_status` (draft → submitted → late → grading → graded) and `ai_job_status` (pending → processing → completed → failed) are PostgreSQL enums, enforcing valid states at the database level rather than application code. Adding new states requires a migration, but state machine changes should be deliberate.

**Composite unique constraints** prevent data corruption from race conditions:
- `enrollments(userId, courseId)` — one enrollment per student per course
- `answers(submissionId, questionId)` — one answer per question per submission
- `assignmentQuestions(assignmentId, questionId)` — no duplicate questions

**Cost stored as string.** `aiGradingJobs.cost` uses `text` rather than `float` to avoid floating-point precision drift over thousands of jobs with fractional-cent values.

**Indexes** on foreign keys (`course_id`, `user_id`, `assignment_id`, `answer_id`, `batch_id`, `status`) for query performance on common access patterns.

*Evidence: `src/db/schema.ts` (complete schema definition), `src/db/README.md` (design decisions)*

### 6.3 API Design

**Response Format.** All endpoints return a consistent shape:
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "Human-readable message" }
```

This enables a single error handling path on the client.

**Route Structure.** 11 route modules with one file per resource:

| Module | Prefix | Example Endpoints |
|--------|--------|-------------------|
| `auth` | `/api/auth` | `POST /signin`, `POST /password-login`, `GET /me`, `POST /refresh` |
| `courses` | `/api/courses` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id` |
| `assignments` | `/api/assignments` | `GET /`, `POST /`, `PATCH /:id/publish`, `GET /:id/analytics` |
| `submissions` | `/api/submissions` | `POST /`, `PATCH /:id/submit`, `GET /:id` |
| `questions` | `/api/questions` | `GET /`, `POST /`, `PATCH /:id` |
| `auto-grade` | `/api/auto-grade` | `POST /batch`, `POST /accept/:id`, `POST /batch-accept`, `GET /queue` |
| `notifications` | `/api/notifications` | `GET /`, `PATCH /:id/read`, `POST /mark-all-read` |
| `settings` | `/api/settings` | `GET /llm`, `PUT /llm`, `GET /providers` |
| `users` | `/api/users` | `GET /`, `PATCH /:id` |
| `admin` | `/api/admin` | `POST /users/bulk`, `GET /users` |
| `tags` | `/api/tags` | `GET /` |

**Validation.** Zod schemas validate all request bodies and query parameters at the route boundary. If validation fails, a 400 response is returned before handler logic runs, guaranteeing typed inputs inside handlers.

**Rate Limiting.**
- Global: 1000 req/15min per IP
- Auth endpoints: 5 req/min per IP
- Forgot password: 3 req/min per IP

**Security Headers.** CSP, HSTS, X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Permissions-Policy (camera/mic/geo disabled), Referrer-Policy.

*Evidence: `src/server/index.ts` (middleware chain), `src/server/routes/` (all route modules)*

---

## 7. Design Patterns Used

### 7.1 Factory Pattern — LLM Provider
`getModel()` in `src/server/lib/ai.ts` returns either an OpenAI or Anthropic model instance based on database/env configuration. The consumer code is unaware of which provider is active — it calls `generateAIObject()` and receives a typed response regardless of the underlying LLM.

**Why.** Enables provider switching via configuration without code changes. Schools with different API access can use whichever provider is available.

### 7.2 Strategy Pattern — Prompt Versioning
Two prompt strategies (v1: balanced, v2: strict) are defined in `src/server/config/prompts.ts`. The active strategy is selected via `PROMPT_VERSION` env var. Each strategy implements the same interface (`system` prompt + `user` function) but with different grading philosophy.

**Why.** Allows A/B testing of grading approaches and tuning per-institution without code changes.

### 7.3 Middleware Chain Pattern
Hono's middleware pipeline in `src/server/index.ts` composes security concerns in order:
1. Security headers (CSP, HSTS)
2. CORS
3. Body size limits (10MB for CSV upload, 1MB global)
4. Rate limiting (stricter for auth, general for API)
5. Auth (JWT validation, user attachment)
6. Route handlers

**Why.** Each middleware is a single concern, composable and testable independently. Order matters: security headers must be first (every response gets them), auth must be before routes.

### 7.4 Observer Pattern (Simplified) — Batch Notifications
`checkBatchCompletion()` checks after each grading job whether the batch is complete. If all jobs in a batch are done, it inserts a notification for the triggering staff member. This is a simplified observer pattern without a formal event bus.

**Why.** Avoids polling — staff trigger grading and are notified when it's done without repeatedly checking the dashboard.

### 7.5 Repository Pattern (Implicit via Drizzle)
Database access uses Drizzle's query builder directly in route handlers and jobs. While there's no formal repository abstraction, the ORM provides a typed interface that acts as a lightweight data access layer.

### 7.6 Singleton Pattern — Settings Cache
The LLM settings cache in `ai.ts` is a module-level singleton with TTL-based invalidation. A single cached value is shared across all requests within the same process.

### 7.7 Custom Hook Pattern (React)
Each feature module exposes custom hooks that encapsulate data fetching, state management, and mutations:
- `useAssignmentData` — read-only data fetching with TanStack Query
- `useAnswerManagement` — write logic with dirty tracking, debounced saves
- `useGrading` — grading workspace state and keyboard shortcuts

**Why.** Separates concerns within features and prevents "god component" anti-patterns. TanStack Query handles server state; hooks handle UI-specific local state.

---

## 8. Architectural Patterns Used

### 8.1 Client-Rendered SPA (No SSR)
The entire platform is behind authentication — no public pages benefit from server rendering. A client-rendered SPA avoids the complexity of SSR frameworks (Next.js, Remix) while keeping the build pipeline simple: Vite produces static files that any web server can host.

**Tradeoff.** No SEO, no server-side rendering. But for an authenticated assessment platform, this is irrelevant.

*Evidence: `src/client/README.md`*

### 8.2 Monolithic Backend with Modular Routes
The server is a single Hono application, but routes are split into ~15 resource-based files. This provides the simplicity of a monolith (single deployment, shared database, no inter-service communication) with the maintainability of modular code.

**Why.** A microservices architecture would be over-engineering for a school assessment platform. The monolith keeps deployment simple (one Docker image, one process) while resource-based files keep individual modules manageable.

### 8.3 Separated Web + Worker (Process-Level Separation)
The web server and background worker are separate Node.js processes sharing the same codebase. They share the same Docker image but have different entrypoints (`index.js` vs `worker.js`). This is a lightweight form of service separation without full microservices.

**Why.** Long-running LLM calls (up to 60s) would block HTTP response times if handled in the web process. Separation allows independent scaling — web scales for exam traffic, worker scales for grading queue depth.

**Tradeoff.** Two deployments instead of one, but the operational overhead is minimal since they share the same image.

*Evidence: `src/server/index.ts`, `src/server/worker.ts`, `k8s/web.yaml`, `k8s/worker.yaml`*

### 8.4 PostgreSQL as Universal Infrastructure
PostgreSQL serves as:
1. **Application database** — all domain data
2. **Job queue** — Graphile Worker uses `graphile_worker` schema with advisory locks
3. **Auth store** — Supabase Auth uses PostgreSQL internally
4. **Settings store** — `systemSettings` key-value table

**Why.** Eliminates Redis, RabbitMQ, and other infrastructure dependencies. For a school deployment that already runs PostgreSQL, this means zero additional infrastructure to maintain.

**Tradeoff.** PostgreSQL is not optimised for high-throughput job processing, but with concurrency=1 and jobs taking 5-60 seconds each, throughput is not the bottleneck.

### 8.5 Feature-Based Frontend Architecture
The frontend is organised by **feature** (not by component type):
```
features/
├── staff-grading/     # hooks/, components/, types.ts
├── student-assignment/ # hooks/, components/, types.ts
└── ...
```

Each feature is self-contained with its own components, hooks, and types. Shared primitives (Modal, Sidebar) live in `components/`.

**Why.** High cohesion within features — a developer working on grading doesn't need to navigate unrelated student submission code. Feature-specific types stay close to where they're used.

**Tradeoff.** Some code duplication across features (loading states, error handling). This is intentional — premature abstraction across features with different data shapes leads to leaky abstractions.

### 8.6 Human-in-the-Loop AI Grading
The AI grading system is designed as an **assistant**, not a replacement:
1. LLM produces a grading suggestion (points, reasoning, confidence, per-criterion scores)
2. Staff reviews suggestions in the grading workspace
3. Staff accepts, modifies, or rejects each suggestion
4. The `marks` table tracks `isAiAssisted`, `aiSuggestionAccepted`, and `overrideReason` for audit

**Why.** Full automation of grading would raise academic integrity concerns. The human-in-the-loop approach transforms a 10-hour grading session into a 2-3 hour review session while maintaining academic standards.

### 8.7 Horizontal Pod Autoscaling
The web tier uses a Kubernetes HPA with asymmetric scaling:
- **Scale-up**: Aggressive (2 pods per minute) — exam starts → traffic spike → rapid response
- **Scale-down**: Conservative (1 pod per 2 minutes, 5-min stabilisation) — avoid flapping between exam questions

Pod anti-affinity spreads web pods across nodes for redundancy. Rolling updates use `maxUnavailable: 0` to ensure zero-downtime deploys during exams.

*Evidence: `k8s/hpa.yaml`, `k8s/web.yaml`*

---

## 9. Implementation Challenges / Technical Debt

### 9.1 Dual Auth Complexity
Supporting both custom JWT and Supabase authentication adds complexity throughout the stack:
- Auth middleware has two code paths
- Client auth context manages two token sources
- API client checks both localStorage (custom JWT) and Supabase session
- Token refresh logic differs between providers

**Impact.** Every auth-related change must be tested against both flows. This is the price of supporting both on-premise and cloud deployments.

### 9.2 JSONB Type Safety Gap
JSONB columns (`content`, `rubric`, `aiGradingSuggestion`) are typed as `unknown` at the TypeScript level. Content extraction relies on runtime utility functions (`getQuestionContent`, `getAnswerContent`) rather than compile-time type inference.

**Impact.** Type errors in JSONB data are caught at runtime, not compile time. A JSONB schema validation layer (Zod at read time) would close this gap.

### 9.3 Client-Side Filtering Scalability
The question pool, enrollment roster, and submission list use client-side filtering. This works for typical sizes (50-200 items) but won't scale to very large courses.

**Impact.** Courses with 500+ questions or 1000+ students would need server-side filtering with pagination.

### 9.4 No Formal Test Coverage Target
While the project has unit tests (Vitest), integration tests, stress tests, and E2E tests (Playwright), there is no enforced coverage threshold in CI.

**Impact.** Coverage can silently regress. Adding a coverage gate in the CI pipeline would prevent this.

### 9.5 Rate Limiting Without Shared State
Rate limiting is per-pod (in-memory), not shared across pods. With 4 web pods, the effective rate limit is 4x the configured value.

**Impact.** Auth rate limiting (5 req/min) becomes 20 req/min across 4 pods. A Redis-backed rate limiter would provide shared state, but adds infrastructure complexity.

**Decision.** Per-pod limits are adequate for a school network behind a firewall, where the threat model is primarily accidental (student scripts, not coordinated attacks).

### 9.6 localStorage Token Storage
JWTs are stored in `localStorage`, which is accessible to any JavaScript running on the page.

**Impact.** An XSS vulnerability could steal tokens. Mitigated by CSP headers that block inline scripts and restrict script sources, plus 24h token expiry.

**Migration path.** Move to `httpOnly` cookies (requires CSRF protection) if security requirements increase.

### 9.7 Hardcoded Email Patterns
Role inference uses hardcoded NTU email patterns. Multi-institution deployment would require a configurable role-mapping mechanism.

### 9.8 No Real-Time Notifications
Notifications are polled, not pushed via WebSockets. Staff must refresh to see new notifications.

**Impact.** Acceptable for grading (jobs take 5-60s; 30s polling interval is sufficient), but a WebSocket connection would provide better UX for real-time status updates during batch grading.

### 9.9 Daily Usage Stats Race Condition
The `aiUsageStats` update logic (check → update/insert) in grading jobs has a potential race condition if two jobs complete simultaneously for the same day. With concurrency=1, this is currently impossible, but would surface if concurrency is increased.

---

## 10. Limitations and Possible Future Improvements

### 10.1 Current Limitations

| Limitation | Impact | Root Cause |
|-----------|--------|------------|
| Single-institution email patterns | Cannot deploy for multiple schools without code changes | Hardcoded role inference |
| No real-time features | Staff must poll for grading status | No WebSocket infrastructure |
| English-only LLM grading | Cannot grade answers in other languages reliably | Prompts are English-only |
| No plagiarism detection | Cannot detect copied answers across submissions | Out of current scope |
| No mobile-optimised UI | UML editor unusable on mobile | Desktop-first design |
| No offline-first client | Students lose work if connection drops mid-save | SPA requires connectivity |
| No question import/export | Cannot share question pools between courses | Not yet implemented |
| LLM cost unpredictable | Costs depend on answer length, not fixed per student | Inherent to LLM pricing |
| No coding question auto-grading | Coding questions rely on manual grading | Sandbox execution not implemented |

### 10.2 Possible Future Improvements

**Short-Term (Low Effort, High Impact)**
1. **Configurable role mapping** — Move email-to-role patterns to `systemSettings` for multi-institution support.
2. **Server-side question filtering** — Add pagination and full-text search for large question pools.
3. **Test coverage gate in CI** — Enforce minimum coverage threshold to prevent regression.
4. **Shared rate limiting** — Use PostgreSQL-based rate limiting (already available via Graphile Worker's job table pattern) for cross-pod limits.

**Medium-Term (Moderate Effort)**
5. **WebSocket notifications** — Push grading progress to staff in real time. Would use a lightweight WebSocket layer (e.g., Hono WebSocket adapter).
6. **Coding question auto-grading** — Integrate a sandboxed code execution engine (e.g., Judge0, Piston) for automated test-case-based grading.
7. **Multi-language prompt support** — Allow configuring prompts per language for institutions with non-English curricula.
8. **Question import/export** — JSON/CSV export of question pools for sharing across courses and semesters.
9. **LLM cost budgets** — Per-course or per-assignment cost limits with automatic stopping when budget is exhausted.

**Long-Term (High Effort)**
10. **Plagiarism detection** — Cross-submission similarity analysis using embedding-based comparison (could leverage the existing LLM infrastructure).
11. **Offline-first client** — Service worker + IndexedDB for offline answer caching with sync-on-reconnect.
12. **Multi-tenant architecture** — Namespace isolation for multiple institutions on a single deployment.
13. **Advanced UML grading** — Structural comparison (graph isomorphism) rather than purely LLM-based assessment, for more deterministic grading of class diagrams.
14. **Learning analytics** — Track student performance over time, identify at-risk students, recommend study topics based on weak areas.
15. **Per-course LLM configuration** — Allow different courses to use different models or prompt versions while keeping API keys centralised.

---

## Appendix A: Design Decisions Summary

| Decision | Why | Tradeoff |
|----------|-----|----------|
| Client-rendered SPA (no SSR) | All pages behind auth; simpler deployment | No SEO (irrelevant for this use case) |
| Feature-based module structure | High cohesion, independent features | Some code duplication |
| Custom hooks over global state | TanStack Query handles server state; remaining state is UI-specific | More boilerplate per feature |
| Dual JWT auth (custom + Supabase) | Supports offline on-premise + cloud deployments | Added auth complexity |
| Email-based role inference | Zero onboarding friction, no admin panel needed | Hardcoded to NTU email patterns |
| Schema-first Drizzle ORM | Reviewable SQL migrations, type inference | More upfront schema work |
| JSONB for polymorphic content | Avoids 4+ content tables with complex joins | Less queryable, no compile-time types |
| PostgreSQL enums for state machines | Database-level state validation | New states require migration |
| Graphile Worker (no Redis) | Zero additional infrastructure, transactional with DB | Not optimised for high throughput |
| Concurrency = 1 for grading | Predictable cost, simple error handling | Sequential processing (~2-3h for large batches) |
| Function-based prompt templates | Version-controlled, type-safe, reviewable in PRs | Non-technical staff can't edit without code access |
| Cost as string (not float) | Avoids floating-point precision drift | Application-level conversion for display |
| localStorage for JWT | Simple, supports dual-auth system | Vulnerable to XSS (mitigated by CSP) |
| No CSRF protection | Bearer token auth; browsers don't auto-attach custom headers | Must add if cookie-based auth is introduced |
| Per-pod rate limiting (no Redis) | Adequate for school network behind firewall | Effective limit = N × configured limit |
| Separated web + worker | LLM calls don't block HTTP; independent scaling | Two deployments |
| Managed Supabase (no in-cluster DB) | No DBA overhead, built-in backups/PITR | Requires internet from cluster |
| Asymmetric HPA scaling | Fast scale-up for exam starts, slow scale-down to avoid flapping | May over-provision briefly after exam ends |

## Appendix B: File Structure Reference

```
src/
├── client/                              # React SPA (~18,000 LoC)
│   ├── main.tsx                         # App entry + TanStack Query/Router setup
│   ├── routes/                          # File-based TanStack Router (20 pages)
│   │   ├── __root.tsx                   # Root layout with Sidebar
│   │   ├── login.tsx                    # Login page (custom JWT + Supabase)
│   │   ├── student/                     # Student routes (4 pages)
│   │   └── staff/                       # Staff routes (8 pages + admin)
│   ├── features/                        # Feature modules (10 modules)
│   │   ├── staff-course/                # Course management (tabbed)
│   │   ├── staff-grading/               # Side-by-side grading workspace
│   │   ├── student-assignment/          # Exam-taking interface
│   │   └── ...
│   ├── components/                      # Shared UI (Modal, Sidebar, UMLEditor)
│   ├── contexts/AuthContext.tsx          # Dual auth state + admin view-as
│   └── lib/api.ts                       # Centralised API client
│
├── server/                              # Hono API (~10,000 LoC)
│   ├── index.ts                         # Server entry + middleware chain
│   ├── worker.ts                        # Standalone Graphile Worker entry
│   ├── routes/                          # 11 route modules (~50 handler files)
│   ├── jobs/                            # Background tasks (grading + auto-submit)
│   ├── middleware/auth.ts               # Dual JWT validation + RBAC
│   ├── lib/                             # AI factory, notifications, storage, worker
│   └── config/                          # Prompts, pricing, constants, env validation
│
├── db/                                  # Database layer (~1,500 LoC)
│   ├── schema.ts                        # 15 tables, enums, relations, indexes
│   ├── migrations/                      # 12 auto-generated SQL migrations
│   ├── index.ts                         # Drizzle client setup
│   ├── seed.ts                          # Test data seeding
│   └── migrate.ts                       # Migration runner
│
├── lib/                                 # Shared utilities
│   └── assessment.ts                    # Shared types (RubricCriterion, etc.)
│
├── test/                                # Test suites
│   ├── unit/                            # Vitest unit tests
│   ├── integration/                     # API integration tests
│   ├── stress/                          # Load/stress tests
│   └── e2e/                             # Playwright E2E tests
│
├── k8s/                                 # Kubernetes manifests (9 files)
│   ├── web.yaml                         # Web Deployment (2-6 replicas, HPA)
│   ├── worker.yaml                      # Worker Deployment (1-3 replicas)
│   ├── hpa.yaml                         # Horizontal Pod Autoscaler
│   ├── migration-job.yaml               # Pre-deploy migration Job
│   └── ...
│
├── Dockerfile                           # Multi-stage build (Node 20 Alpine)
├── docker-compose.yml                   # Local development
└── .github/workflows/build-deploy.yml   # CI/CD: test → build → deploy
```
