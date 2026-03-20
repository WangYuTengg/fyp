# UML Assessment Platform — FYP Report Notes

## 1. Project Overview

The UML Assessment Platform is a web-based automated assessment system designed for educational institutions. It supports multiple assessment types — Multiple Choice Questions (MCQ), written responses, coding exercises, and UML diagram submissions — with LLM-assisted grading as its key differentiator.

**Problem Statement**: Manual grading of UML diagrams is time-intensive and subjective. Existing solutions lack structured rubric-based assessment with AI assistance, human-in-the-loop oversight, and full audit trails. No standardised public benchmark exists for rubric-based UML grading — an identified research gap (CSEDU 2025, Ibanez et al. 2025).

**Key Differentiator**: LLM-assisted UML diagram grading with configurable AI providers, structured output validation, human-in-the-loop review workflows, and comprehensive cost/usage tracking. Staff never lose control — AI suggestions must be explicitly accepted or rejected before becoming official marks.

**Scope**: The platform is designed for on-premise school deployment, targeting courses where UML modelling is taught (e.g., software engineering, object-oriented design). It follows a phased implementation plan across 12 weeks:

| Phase | Focus | Status |
|-------|-------|--------|
| Phase 0 | Foundation (scaffolding, auth, DB, Docker) | Complete |
| Phase 1 | Core learning loop (CRUD, submission lifecycle) | Complete |
| Phase 2 | Question pools, assignment builder, auto-save | Complete |
| Phase 3 | UML submission & file handling | Partial |
| Phase 4 | LLM-assisted grading pipeline | Complete |

*Evidence: `DEVELOPMENT_PLAN.md`, `PROJECT_STATUS.md`, `README.md`*

---

## 2. Main Features and User Workflows

### 2.1 Student Workflows

1. **Dashboard & Course Access**: Students see enrolled courses filtered by academic year and semester. Route guards ensure students cannot access staff pages (`src/client/routes/student/`).

2. **Assignment Attempt Flow**:
   - Student starts an assignment → system creates a draft submission (or resumes an existing one)
   - Question navigator allows non-linear navigation with progress indicators
   - Auto-save triggers every 30 seconds when changes are detected (`src/client/features/student-assignment/hooks/useAutoSave.ts`)
   - Timer enforcement: client-side countdown with server-side validation. On expiry, a Graphile Worker cron job auto-submits the draft (`src/server/jobs/auto-submit-expired.ts`)
   - Focus monitoring: `useFocusMonitor()` hook tracks tab switches and reports them via API. Exceeding `maxTabSwitches` triggers auto-submission (`src/client/features/student-assignment/hooks/useFocusMonitor.ts`)
   - Submission confirmation dialog with unsaved-changes warning on `beforeunload`

3. **Results Viewing**: Students see grades only after staff publishes results. Graded submissions display per-question marks, feedback, and any late penalties applied.

### 2.2 Staff Workflows

1. **Course Management**: Staff create courses, manage rosters via individual or CSV bulk enrollment, and export grades to CSV (`src/server/routes/courses.ts`).

2. **Question Pool**: Reusable questions scoped to courses with tag-based organisation. Supports search, filtering by type/tags, and import/export via CSV (`src/client/features/staff-course/`).

3. **Assignment Builder**: Create assignments with questions drawn from the pool. Configurable: time limits, max attempts, late penalty policies (none/fixed/per_day/per_hour with cap), question shuffling, focus monitoring thresholds, MCQ penalty per wrong selection, and attempt scoring method (latest/highest).

4. **Grading Dashboard**: Two-panel layout — submission list on the left, grading form on the right. Staff can:
   - Grade manually with per-question point and feedback inputs
   - Trigger batch AI grading for written/UML questions
   - Review AI suggestions: accept (creates official mark) or reject (clears suggestion)
   - Override previously graded marks with audit trail (reason, previous score)
   - Navigate between submissions with previous/next buttons

5. **AI Grading Management**: Staff trigger batch or single AI grading, monitor job progress, view queue status, and track LLM token usage and costs (`src/client/features/staff-course/` auto-grading tab).

6. **Notifications**: Real-time notification centre for grading events (completion, failure, batch auto-submissions) with 30-second polling (`src/client/features/staff-notifications/`).

### 2.3 Admin Workflows

1. **User Management**: CRUD operations on users with bulk CSV import, role assignment, account deactivation, and password resets (`src/server/routes/admin.ts`).

2. **System Settings**: Configure LLM provider (OpenAI/Anthropic) and model globally. Settings cached for 60 seconds to reduce DB queries (`src/server/routes/settings.ts`).

3. **Impersonation**: Admin sidebar includes a "View as" toggle (Student/Staff) that changes the effective role for navigation without altering actual permissions. This persists in `localStorage` (`src/client/contexts/AuthContext.tsx`).

*Evidence: `src/client/features/`, `src/server/routes/`, `src/client/components/Sidebar.tsx`*

---

## 3. System Architecture

### 3.1 High-Level Architecture

The platform follows a **monolithic full-stack architecture** with clear client-server separation within a single repository:

```
┌─────────────────────────────────────────────────────────┐
│                    Client (React SPA)                    │
│  Vite 7 + React 19 + TanStack Router + TanStack Query  │
│              Tailwind CSS + Headless UI                  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP (REST JSON)
                       │ Authorization: Bearer <JWT>
┌──────────────────────▼──────────────────────────────────┐
│                   Server (Hono + Node.js)                │
│  ┌──────────┐  ┌─────────────┐  ┌────────────────────┐ │
│  │ Auth MW   │  │ Route       │  │ Background Jobs    │ │
│  │ (JWT +    │  │ Handlers    │  │ (Graphile Worker)  │ │
│  │ Supabase) │  │ (~15 files) │  │ - auto-grade       │ │
│  └──────────┘  └─────────────┘  │ - auto-submit      │ │
│                                  └──────┬─────────────┘ │
└──────────────────────┬──────────────────┼───────────────┘
                       │                  │
        ┌──────────────▼──────────────────▼───────────┐
        │          PostgreSQL (Neon)                    │
        │          Drizzle ORM (16 tables)             │
        └──────────────────────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────┐
        │          External Services                    │
        │  ┌───────────┐  ┌──────────┐  ┌───────────┐│
        │  │ Supabase   │  │ OpenAI   │  │ Anthropic ││
        │  │ (Auth)     │  │ (LLM)    │  │ (LLM)     ││
        │  └───────────┘  └──────────┘  └───────────┘│
        └─────────────────────────────────────────────┘
```

**Design Decision — Monorepo over Microservices**:
- **Why**: Single developer (FYP), shared TypeScript types between client/server, simpler deployment, reduced operational overhead
- **Tradeoff**: Coupling between client and server code; harder to scale independently. Acceptable for an academic prototype targeting on-premise school deployment
- **How it helps**: Faster iteration, single `npm run dev` starts everything, shared Zod schemas for validation

### 3.2 Client Architecture

The client is a **single-page application (SPA)** with no server-side rendering.

- **Decision — SPA over SSR**: The platform is an internal tool behind authentication, not a public-facing website. SEO is irrelevant, and the interactive assessment-taking experience benefits from client-side state management (auto-save, timers, focus monitoring)
- **Feature-based module structure**: Each feature directory contains its own hooks, components, types, and utils — keeping related code co-located rather than grouped by technical concern
- **Routing**: TanStack Router with file-based route generation provides type-safe routing and automatic code splitting

*Evidence: `src/client/README.md` — documents trade-offs for SPA choice and feature-based structure*

### 3.3 Server Architecture

The server uses **Hono** (lightweight HTTP framework) with resource-based route files.

- **Decision — Hono over Express**: Hono is lighter, TypeScript-first, and has built-in middleware support. Express is heavier and its typing story is weaker
- **Route organisation**: One file per resource (courses, assignments, submissions, etc.) — keeps each file focused and manageable (`src/server/routes/`)
- **Background processing**: Graphile Worker for async LLM grading jobs, running at `concurrency=1` to control LLM API costs and prevent rate limiting

*Evidence: `src/server/README.md` — documents resource-based route decision*

### 3.4 Deployment Architecture

- **Containerised**: Multi-stage Docker build (builder → production) with non-root user for security (`Dockerfile`)
- **CI/CD**: GitHub Actions pipeline: lint → test → build Docker image → push to `ghcr.io` (`/.github/workflows/build-deploy.yml`)
- **Database**: Neon PostgreSQL (serverless) with Drizzle ORM migrations
- **Auth**: Supabase for authentication (magic links + email/password), with custom JWT layer for on-premise password-only deployments

---

## 4. Tech Stack and Dependencies

### 4.1 Core Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Language** | TypeScript (strict) | — | Type safety across the full stack; shared types between client and server |
| **Frontend Framework** | React | 19.2 | Component model, ecosystem maturity, hooks for state management |
| **Build Tool** | Vite | 7.2 | Fast HMR, ESM-native, excellent TypeScript support |
| **Routing** | TanStack Router | 1.156 | File-based, type-safe, built-in search params, code splitting |
| **Server State** | TanStack Query | 5.90 | Caching, deduplication, background refetching, mutation support |
| **CSS** | Tailwind CSS | 4.1 | Utility-first, no context switching, rapid prototyping |
| **UI Components** | Headless UI | — | Accessible, unstyled primitives (modals, menus) |
| **HTTP Framework** | Hono | 4.11 | Lightweight, TypeScript-first, middleware-based, edge-ready |
| **ORM** | Drizzle ORM | 0.45 | Schema-first, type-safe queries, thin abstraction over SQL |
| **Database** | PostgreSQL (Neon) | — | JSONB for flexible content, mature, reliable |
| **Auth** | Supabase + custom JWT | 2.91 / jose 6.2 | Dual auth: magic links for convenience, password for on-premise |
| **Background Jobs** | Graphile Worker | 0.16 | PostgreSQL-native job queue, no Redis dependency, reliable delivery |
| **AI/LLM** | Vercel AI SDK | 6.0 | Provider-agnostic, structured output (Zod), streaming support |
| **Validation** | Zod | 4.3 | Runtime validation + TypeScript inference, composable schemas |
| **Email** | Nodemailer | 8.0 | Password reset emails, notification delivery |

### 4.2 AI/LLM Dependencies

| Package | Purpose |
|---------|---------|
| `ai` (Vercel AI SDK) | Provider abstraction, `generateObject()` for structured LLM output |
| `@ai-sdk/openai` | OpenAI provider (GPT-4o, GPT-4o-mini) |
| `@ai-sdk/anthropic` | Anthropic provider (Claude 3.5 Sonnet, Claude 3 Opus) |
| `zod` | LLM output schema validation — ensures JSON responses match expected structure |

### 4.3 Development & Testing

| Tool | Purpose |
|------|---------|
| Vitest | Unit + integration testing |
| Playwright | End-to-end testing (`e2e/`) |
| ESLint | Linting (no auto-fix in CI) |
| tsx | TypeScript execution for server dev mode |
| drizzle-kit | Migration generation and studio |

*Evidence: `package.json`*

---

## 5. Key Modules/Components

### 5.1 Authentication Module

**Files**: `src/server/middleware/auth.ts`, `src/client/contexts/AuthContext.tsx`

**Dual Authentication Strategy**:
- **Custom JWT (fast path)**: HS256 verification using `jose` library. Payload contains `{sub: userId, email, role}`. Used for on-premise password-based deployments
- **Supabase JWT (fallback)**: Remote verification via `supabase.auth.getUser()`. Supports magic links and OAuth flows. Auto-creates local DB user on first login

**Role Inference from Email Domain**:
```
@staff.main.ntu.edu.sg → staff
@e.ntu.edu.sg → student
specific admin emails → admin
```

**Design Decision**: Dual auth was chosen to support both cloud (Supabase magic links) and on-premise (password-only) deployments without code changes. The tradeoff is increased middleware complexity and two code paths to maintain.

**Token Refresh (JWT Rotation)**: On 401 response, the API client attempts to refresh using a stored refresh token. Concurrent refresh requests are deduplicated using an `isRefreshing` flag. This prevents token expiry from disrupting the student's assignment-taking experience.

*Evidence: `src/server/middleware/auth.ts`, `src/client/lib/api.ts`, `docs/agents/auth.md`*

### 5.2 Submission Lifecycle Module

**Files**: `src/server/routes/submissions/`, `src/client/features/student-assignment/`

**State Machine**:
```
draft → submitted → grading → graded
         ↓
        late (penalty applied)
```

Key behaviours:
- **Resume draft**: Starting an assignment returns the existing draft if one exists (idempotent)
- **MCQ auto-grading**: Happens synchronously on submit — if all questions are MCQ, submission transitions directly to `graded`
- **Late penalty calculation**: Applied at submit time based on `max(dueDate, startedAt + timeLimit)`. Supports fixed %, per-day %, and per-hour % with configurable cap
- **Auto-submit on timer expiry**: Graphile Worker cron job runs every minute, finds expired drafts, grades MCQs, applies penalties, and notifies staff

**Design Decision**: The submission state machine is intentionally simple (no `re-opened` or `appealed` states) to match the FYP scope. Late penalty is calculated server-side at submission time rather than client-side to prevent manipulation.

### 5.3 AI Grading Pipeline

**Files**: `src/server/jobs/auto-grade-written.ts`, `src/server/jobs/auto-grade-uml.ts`, `src/server/lib/ai.ts`, `src/server/config/prompts.ts`, `src/server/config/pricing.ts`

**Architecture**:
1. Staff triggers batch grading → API creates `aiGradingJob` records → queues Graphile Worker tasks
2. Worker picks up job → fetches answer, question, rubric from DB
3. Calls LLM via Vercel AI SDK's `generateObject()` with Zod schema validation
4. Response validated: `{points, reasoning, confidence, criteriaScores}`
5. Points clamped to `maxPoints` (defensive against LLM hallucination)
6. Stored in `answers.aiGradingSuggestion` (JSONB) — **not** as an official mark
7. Staff reviews suggestion → explicitly accepts (creates mark) or rejects (clears suggestion)
8. Token usage and cost tracked per job; aggregated daily in `aiUsageStats`

**Design Decision — Human-in-the-Loop**: AI suggestions are never automatically promoted to official marks. This was a deliberate choice to maintain academic integrity and give staff confidence in the system. The tradeoff is additional manual steps for staff.

**Design Decision — Graphile Worker at concurrency=1**: Prevents overwhelming LLM APIs with parallel requests, controls costs, and simplifies error handling. The tradeoff is slower batch grading throughput.

**Prompt Versioning**: Two prompt versions (v1 = fair/partial credit, v2 = strict grading) allow experimentation with grading strictness. Prompts are stored in `src/server/config/prompts.ts` rather than the database for version control.

**Cost Tracking**: Token costs stored as strings (not floats) to avoid floating-point precision issues. Pricing table maintained per provider/model in `src/server/config/pricing.ts`.

### 5.4 Question Pool Module

**Files**: `src/server/routes/questions.ts`, `src/client/features/staff-course/`

Questions are **reusable and course-scoped**. A question can appear in multiple assignments via the `assignmentQuestions` join table, with optional per-assignment point overrides.

**JSONB Content Flexibility**: The `content` column uses JSONB with type-specific structures:
- MCQ: `{prompt, options: [{id, text, isCorrect}], allowMultiple}`
- Written: `{prompt, modelAnswer}`
- UML: `{prompt, referenceDiagram, modelAnswer}`
- Coding: `{prompt, template, ...}`

**Design Decision**: JSONB over separate tables per question type. This avoids complex polymorphic joins and makes it trivial to add new question types. The tradeoff is weaker schema enforcement at the DB level — validation is handled by Zod at the application layer.

### 5.5 Student Assignment Attempt Component

**File**: `src/client/features/student-assignment/StudentAssignmentAttempt.tsx`

This is the most complex client-side component, orchestrating multiple concerns:
- Question navigation (non-linear) with progress bar
- Answer state management via discriminated union type (`AnswerState`)
- Auto-save every 30s with dirty tracking
- Focus monitoring with tab-switch detection and auto-submit threshold
- Timer countdown with server-validated time limit
- `beforeunload` warning for unsaved changes
- Submission confirmation modal

**Design Decision**: All answer types use a discriminated union (`AnswerState`) rather than a generic object. This provides exhaustive type checking when rendering different question types and prevents invalid state.

### 5.6 Focus Monitoring & Proctoring

**Files**: `src/client/features/student-assignment/hooks/useFocusMonitor.ts`, `src/server/routes/submissions/`

- Client tracks `visibilitychange` and `blur`/`focus` events
- Each tab switch reported to server with timestamps and duration
- Server stores tab switches in `submissions.tabSwitches` (JSONB array)
- API response indicates whether auto-submit should trigger (exceeding threshold)
- Toast warning: "Your activity is being monitored"

**Design Decision**: Focus monitoring is opt-in per assignment (`monitorFocus` flag). This gives staff flexibility — low-stakes quizzes can disable monitoring, while exams enable it. The `maxTabSwitches` threshold allows for accidental switches before triggering auto-submit.

*Evidence: `src/client/features/student-assignment/`, `src/server/routes/submissions/`*

---

## 6. Database / API Design

### 6.1 Database Schema

The database contains **16 tables** managed by Drizzle ORM with a schema-first approach.

**Core Entity Relationships**:
```
users ──< enrollments >── courses
                              │
                    assignments ──< assignmentQuestions >── questions ──< tags (via question_tags)
                              │                                              │
                    submissions ──< answers ──< marks                   rubrics
                              │         │
                   tabSwitches    aiGradingSuggestion
                   (JSONB)          (JSONB)
                              │
                    aiGradingJobs ── aiUsageStats (daily aggregate)
```

**Key Design Decisions**:

1. **JSONB for flexible content**: Question content, rubrics, MCQ options, tab switch logs, AI grading suggestions, and late penalty details all use JSONB columns. This provides schema flexibility without requiring migrations when content structures evolve.
   - **Tradeoff**: Weaker database-level validation; relies on Zod at the application layer
   - **Why**: Different question types have fundamentally different data shapes. A relational approach would require either polymorphic tables (complex) or wide tables with nullable columns (wasteful)

2. **Enums for state machines**: `user_role` (admin/staff/student), `submission_status` (draft/submitted/late/grading/graded), `ai_job_status` (pending/processing/completed/failed). PostgreSQL enums enforce valid state transitions at the DB level.

3. **Composite unique constraints**: `(userId, courseId)` on enrollments, `(submissionId, questionId)` on answers, `(assignmentId, questionId)` on assignment_questions. These prevent data duplication at the DB level.

4. **Cost as string**: `aiGradingJobs.cost` and `aiUsageStats.totalCost` stored as strings to avoid floating-point precision issues in financial calculations.

5. **Audit trail in marks**: The `marks` table tracks `markedBy`, `isAiAssisted`, `aiSuggestionAccepted`, `overrideReason`, and `previousScore` — providing a full history of grading decisions for academic integrity.

6. **Soft deactivation**: Users have `deactivatedAt` rather than being deleted, preserving referential integrity for historical submissions and grades.

*Evidence: `src/db/schema.ts`, `src/db/README.md`*

### 6.2 API Design

**Response Format** (consistent across all endpoints):
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "User-friendly message", "code": "ERROR_CODE" }
```

**Resource-Based Routing** (~15 route files):

| Resource | Endpoints | Auth Level |
|----------|-----------|------------|
| `/api/auth/*` | 9 endpoints (login, signup, magic link, refresh, reset) | Public + Authenticated |
| `/api/courses/*` | 8 endpoints (CRUD, enroll, bulk-enroll, export grades) | Staff/Admin |
| `/api/assignments/*` | 11 endpoints (CRUD, publish, clone, add/remove/reorder questions) | Staff/Admin |
| `/api/questions/*` | 6 endpoints (CRUD, import/export, rubrics) | Staff/Admin |
| `/api/submissions/*` | 7 endpoints (start, save, submit, focus-event, results) | Student + Staff |
| `/api/auto-grade/*` | 7 endpoints (batch, single, queue, stats, accept/reject) | Staff/Admin |
| `/api/admin/*` | 5 endpoints (user CRUD, bulk-create, reset-password) | Admin only |
| `/api/settings/*` | 3 endpoints (LLM providers, get/set settings) | Admin only |
| `/api/notifications/*` | 4 endpoints (list, read, mark-all-read, unread-count) | Authenticated |

**Rate Limiting**: 1000 requests per 15 minutes per IP (`hono-rate-limiter`).

**Design Decision — REST over GraphQL**: REST was chosen for simplicity and familiarity. The platform's data access patterns are well-defined (CRUD operations, not complex graph queries), making REST a natural fit. GraphQL would add complexity without meaningful benefit for this scope.

*Evidence: `src/server/routes/`, `src/server/README.md`, `docs/agents/api-design.md`*

---

## 7. Design Patterns Used

### 7.1 Factory Pattern — LLM Provider

**File**: `src/server/lib/ai.ts`

The `getModel()` function acts as a factory that returns the appropriate LLM provider based on system settings:
```typescript
async function getModel() {
  const { provider, model } = await getLLMSettings();
  return provider === 'anthropic' ? anthropic(model) : openai(model);
}
```
- Settings cached for 60 seconds to reduce DB queries
- Switching providers requires only a settings change, not code changes
- Enables A/B testing between models (e.g., comparing GPT-4o vs Claude for grading accuracy)

### 7.2 State Machine Pattern — Submission Lifecycle

**File**: `src/db/schema.ts` (enum), `src/server/routes/submissions/`

Submissions follow a defined state machine: `draft → submitted/late → grading → graded`. State transitions are enforced server-side — the client cannot set arbitrary statuses. This prevents invalid states (e.g., grading a draft, or re-submitting a graded submission).

### 7.3 Discriminated Union Pattern — Answer Types

**File**: `src/client/features/student-assignment/types.ts`

```typescript
type AnswerState =
  | { type: 'written'; text: string }
  | { type: 'coding'; text: string }
  | { type: 'mcq'; selectedOptionIds: string[] }
  | { type: 'uml'; umlText: string; editorState?: ClassDiagramState }
```

TypeScript's exhaustive checking ensures all question types are handled in rendering and grading logic. Adding a new question type generates compile-time errors at all switch/if sites.

### 7.4 Repository Pattern (Implicit) — API Client

**File**: `src/client/lib/api.ts`

API calls are organised into namespace objects (`coursesApi`, `assignmentsApi`, `submissionsApi`, etc.) that abstract HTTP details. Components call `coursesApi.getById(id)` rather than manually constructing fetch requests. This centralises auth token injection, error handling, and response parsing.

### 7.5 Observer Pattern — Auth State Changes

**File**: `src/client/contexts/AuthContext.tsx`

Supabase's `onAuthStateChange` listener acts as an observer — when the auth state changes (login, logout, token refresh), all subscribed components re-render via React Context. The token refresh flow also uses a deduplication mechanism (`isRefreshing` flag) to prevent concurrent refresh attempts.

### 7.6 Strategy Pattern — Late Penalty Calculation

**File**: `src/server/routes/submissions/submit-submission.ts`

Late penalties use a strategy-like approach based on `latePenaltyType`:
- `none`: No penalty
- `fixed`: Flat percentage deduction
- `per_day`: Percentage per calendar day late
- `per_hour`: Percentage per hour late

Each strategy calculates the penalty independently, capped at `latePenaltyCap`. The approach is data-driven — the assignment configuration determines which strategy is applied.

### 7.7 Command Pattern — Background Job Payloads

**File**: `src/server/jobs/`

Each Graphile Worker job receives a typed payload (command) that encapsulates everything needed to execute the grading task:
```typescript
{ answerId, questionId, submissionId, userId, batchId?, jobId, rubricOverride? }
```
Jobs are fire-and-forget from the API's perspective — the job queue handles retries, ordering, and execution.

---

## 8. Architectural Patterns Used

### 8.1 Client-Server Separation (Monorepo)

The client and server are **separate applications** in a single repository. The client builds to static files served by the Hono server in production. In development, Vite's dev server runs independently with API proxy.

- **Why**: Shared TypeScript types, single deployment artifact, simpler CI/CD for a solo developer
- **Tradeoff**: Cannot scale client and server independently; build times grow with codebase size

### 8.2 Feature-Based Module Architecture (Frontend)

```
src/client/features/
├── student-dashboard/     # Hooks + components for student home
├── student-assignment/    # Assignment attempt (most complex feature)
├── staff-course/          # Course management, question pool, grading config
├── staff-grading/         # Grading interface
├── admin-users/           # User management
└── ...
```

Each feature is a self-contained module with its own hooks, components, types, and utilities. Cross-feature dependencies flow through shared components (`src/client/components/`) and the auth context.

- **Why**: Co-locates related code, reduces cognitive load (developer works in one directory for one feature), prevents circular dependencies
- **Tradeoff**: Some duplication of patterns across features; shared abstractions may emerge late
- **How it helps**: New features can be added by creating a new directory without touching existing code

*Evidence: `src/client/README.md`*

### 8.3 Resource-Based API Architecture (Backend)

One route file per resource (courses, assignments, submissions, questions, admin, settings, notifications, auto-grade). Each file registers its own Hono routes and exports a router.

- **Why**: Keeps individual files focused (~200-400 lines each), easy to find endpoint logic
- **Tradeoff**: Cross-cutting concerns (e.g., "what happens when a submission is created?") span multiple files

### 8.4 Async Job Queue Architecture (Grading Pipeline)

LLM grading is decoupled from the HTTP request cycle via Graphile Worker:

```
HTTP Request (staff triggers grading)
    │
    ▼
Create aiGradingJob record (status: pending)
    │
    ▼
Queue Graphile Worker task
    │
    ▼ (async, potentially minutes later)
Worker executes LLM call → validates response → stores suggestion
    │
    ▼
Notification sent to staff
```

- **Why**: LLM calls take 5-60 seconds — too slow for synchronous HTTP responses. Background processing prevents request timeouts and allows batch operations
- **Why PostgreSQL-native (Graphile Worker) over Redis-based (BullMQ)**: Eliminates Redis dependency, uses existing PostgreSQL for job persistence, guaranteed delivery via database transactions
- **Tradeoff**: `concurrency=1` limits throughput; large batches queue for extended periods

### 8.5 Dual Authentication Architecture

Two auth pathways co-exist:

1. **Supabase Auth** (cloud): Magic links, OAuth, session management delegated to Supabase
2. **Custom JWT** (on-premise): Password-based login, bcrypt hashing, JWT signing with `jose`, refresh token rotation

The middleware tries custom JWT first (faster, no network call), falling back to Supabase verification.

- **Why**: Schools deploying on-premise may not have Supabase access. Dual auth ensures the platform works in both environments
- **Tradeoff**: Two code paths to maintain and test; potential for auth inconsistencies

*Evidence: `src/server/middleware/auth.ts`, `docs/agents/auth.md`*

### 8.6 Schema-First Database Design

Database changes follow: modify `src/db/schema.ts` → `npm run db:generate` → review SQL → `npm run db:migrate`. The TypeScript schema is the single source of truth.

- **Why**: Type-safe queries via Drizzle's `$inferSelect`/`$inferInsert`, no manual type synchronisation, migrations are auto-generated
- **Tradeoff**: Drizzle's migration generation sometimes produces suboptimal SQL; manual review is required

*Evidence: `src/db/README.md`, `drizzle.config.ts`*

---

## 9. Implementation Challenges / Technical Debt

### 9.1 Challenges Encountered

1. **Dual Auth Complexity**: Maintaining two authentication pathways (Supabase + custom JWT) increased middleware complexity. Edge cases like token expiry during an exam required careful handling — the token refresh mechanism with deduplication was added specifically for this (`src/client/lib/api.ts`).

2. **LLM Output Reliability**: LLM responses sometimes return points exceeding `maxPoints` or malformed JSON. The platform mitigates this with Zod schema validation and point clamping, but occasional failures still occur — tracked via `aiGradingJobs.error` (JSONB) and staff notifications.

3. **JSONB Schema Evolution**: Using JSONB for question content provides flexibility but means the application layer must handle all structural validation. Changes to content schemas require careful migration of existing data.

4. **Timer Synchronisation**: Client-side countdown timers can drift from server time. The auto-submit cron job (`auto-submit-expired.ts`) running every minute is the server-side safety net, but there can be up to a 60-second gap between client timer expiry and server-enforced submission.

5. **Focus Monitoring Limitations**: Browser `visibilitychange` events are not fully reliable — some browser extensions, OS notifications, and multi-monitor setups can produce false positives. The threshold approach (`maxTabSwitches`) mitigates this but doesn't eliminate it.

### 9.2 Known Technical Debt

1. **Test Coverage**: While the project has test infrastructure (Vitest, Playwright, integration/regression/smoke/stress tests in `src/test/`), coverage is incomplete. The B-group tests (`b1-bulk-review`, `b2-side-by-side`, etc.) suggest planned features that may not be fully implemented.

2. **No WebSocket/SSE for Real-Time Updates**: Notification polling every 30 seconds is inefficient. Grading progress updates require manual page refresh. WebSocket or Server-Sent Events would provide better UX.

3. **Single-Grader AI**: Only one LLM call per answer. Multi-model consensus grading (e.g., grade with both GPT-4o and Claude, flag discrepancies) would improve reliability but is not implemented.

4. **No Caching Layer**: Server-side caching is minimal (LLM settings cached 60s). Frequently accessed data (course details, question pools) could benefit from Redis caching.

5. **Limited Error Recovery for Grading Jobs**: Failed AI grading jobs are marked as failed with error details, but there's no automatic retry mechanism beyond Graphile Worker's built-in retry.

6. **Migration File Management**: The `PROJECT_STATUS.md` notes migration file cleanup was needed, suggesting some churn in the early schema design phase.

*Evidence: `src/test/`, `PROJECT_STATUS.md`, `src/server/jobs/`*

---

## 10. Limitations and Possible Future Improvements

### 10.1 Current Limitations

1. **UML Input Format**: Currently supports PlantUML text input. Visual diagram editors (drag-and-drop class diagrams) are partially implemented but not complete. Students unfamiliar with PlantUML syntax face a learning curve.

2. **Single Institution**: The system is designed for one institution at a time. Multi-tenancy (multiple schools sharing one deployment) would require schema changes (institution_id foreign keys) and data isolation.

3. **Limited Analytics**: Basic grade export (CSV) exists, but there are no built-in analytics dashboards for learning outcomes, grade distributions, or common student misconceptions.

4. **No Plagiarism Detection**: The platform does not compare submissions across students. For UML diagrams, structural similarity detection could identify copied work.

5. **Scalability**: `concurrency=1` on the Graphile Worker means large batches (e.g., 200 students × 5 questions = 1000 grading jobs) queue for extended periods. The platform is designed for classes of ~50-100 students.

6. **No Offline Support**: The SPA requires a constant internet connection. Students in areas with unreliable connectivity cannot take timed assessments safely.

7. **LLM Provider Lock-in**: While the factory pattern supports OpenAI and Anthropic, adding new providers (Google Gemini, open-source models via Ollama) requires code changes to the provider factory and pricing configuration.

8. **Dataset Limitations for Experiment**: The LLM benchmark experiment (`experiment/`) uses 32 submissions (only 2 real) with single-grader ground truth. No inter-rater reliability measurement is possible with this setup.

### 10.2 Possible Future Improvements

1. **Multi-Model Consensus Grading**: Grade each answer with 2-3 different models and flag discrepancies for human review. This would improve grading reliability and could quantify model agreement.

2. **Real-Time Updates via WebSocket/SSE**: Replace notification polling with WebSocket connections for instant grading progress updates, new notification alerts, and live submission monitoring.

3. **Visual UML Editor**: Complete the drag-and-drop class diagram editor to lower the barrier for students unfamiliar with PlantUML syntax. The `UMLEditor` component in `src/client/components/` has partial support.

4. **Analytics Dashboard**: Learning analytics for staff — grade distributions, per-question difficulty analysis, common misconceptions extracted from LLM grading feedback, and cohort comparisons across semesters.

5. **Plagiarism Detection**: Structural similarity analysis of UML submissions using graph isomorphism algorithms. Could flag suspicious similarity for manual review.

6. **Open-Source LLM Support**: Add Ollama provider to the factory for on-premise LLM deployment, eliminating cloud API costs and data privacy concerns — particularly relevant for schools in regions with data residency requirements.

7. **Accessibility Improvements**: WCAG 2.1 AA compliance for the assessment-taking interface, including screen reader support, keyboard navigation for the UML editor, and high-contrast mode.

8. **Student Self-Assessment**: Allow students to see AI-generated feedback (without scores) before final submission, enabling them to revise their work. This transforms the platform from purely summative to formative assessment.

9. **Rubric Co-Design**: Allow staff to iteratively refine rubrics based on AI grading patterns — e.g., if the AI consistently grades a criterion differently from staff expectations, suggest rubric adjustments.

10. **Horizontal Scaling**: Replace `concurrency=1` with configurable worker pools, potentially across multiple nodes. Would require distributed locking for batch job coordination.

*Evidence: `experiment/README.md` (research questions), `DEVELOPMENT_PLAN.md` (planned features), `PROJECT_STATUS.md` (known limitations)*

---

## Appendix: LLM Benchmark Experiment

The project includes a formal experiment (`experiment/`) to determine the optimal LLM for UML grading, addressing four research questions:

| RQ | Question | Metric |
|----|----------|--------|
| RQ1 | Which LLM achieves highest grading accuracy? | Pearson correlation + MAE vs ground truth |
| RQ2 | What is the cost-performance tradeoff? | USD per submission |
| RQ3 | How consistent are LLM grades across runs? | Std deviation across 5 repeated runs |
| RQ4 | Which model provides the most useful feedback? | Parse success rate + structured output |

**Models tested**: 10 models across 3 providers (OpenAI: GPT-4o, GPT-4o-mini, GPT-4.1-mini, GPT-4.1-nano, o4-mini; Anthropic: Claude Sonnet 4, Claude 3.5 Haiku; Google: Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash).

**Dataset**: 32 UML class diagram submissions (2 real from McGill's uml-grader repository + 30 synthetic across 5 severity tiers and 3 domains). Ground truth graded on 5 criteria × 2 points each.

**Evaluation weights**: Accuracy 30%, Consistency 20%, Cost 15%, Feedback Quality 15%, Speed 10%, Rubric Adherence 10%.

**Output**: Statistical analysis with 6 visualisation types (radar chart, grade correlation scatter plots, cost vs accuracy Pareto frontier, consistency boxplot, latency comparison, per-criterion MAE heatmap).

*Evidence: `experiment/README.md`, `experiment/config.yaml`, `experiment/src/`*
