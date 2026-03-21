# 3 System Design and Architecture

## 3.1 Requirements Analysis

Before architectural decisions could be made, a thorough analysis of both functional and non-functional requirements was conducted. These requirements shaped every subsequent design choice and serve as the foundation against which the system's architecture can be evaluated.

### 3.1.1 Functional Requirements

**User Management and Access Control**

The platform must support three distinct global roles: administrator, staff, and student. Staff roles are further subdivided at the course level into lecturer, teaching assistant (TA), and laboratory executive (lab_exec). This multi-tiered access control model reflects the real-world structure of tertiary institutions, where different categories of staff have different levels of responsibility over course content, grading, and student management. The system must enforce these boundaries both at the API layer (server-side authorisation) and at the interface layer (client-side route guards).

**Course and Enrolment Management**

Administrators and lecturers must be able to create courses and enrol students either individually or in bulk via CSV upload. This dual-mode enrolment is a practical necessity for institutions that maintain student rosters in spreadsheet form at the start of each academic term.

**Question Pool and Assignment Builder**

The platform requires a reusable, course-scoped question pool supporting four question types: multiple-choice (MCQ), written response, coding, and UML diagram. Questions must be taggable to support filtering and reuse across assignments. The assignment builder must allow staff to configure: time limits, maximum attempt counts, late submission penalties (none, fixed, per-day, or per-hour, with an optional cap), question shuffling, and focus monitoring. This level of configurability reflects the diversity of assessment practices across different courses and instructors.

**Student Assessment Flow**

From the student's perspective, the assessment flow must proceed as: start session → auto-save answers every 30 seconds → countdown timer → focus monitoring (detecting tab-switches or window minimisation) → final submission. The auto-save requirement is particularly important: students taking timed assessments risk losing work if a browser crash or network interruption occurs without periodic persistence.

**Submission Lifecycle and Grading**

Submissions must pass through a defined state machine: `draft` → `submitted` (or `late`) → `grading` → `graded`. Staff must be able to trigger AI grading in batch or for individual submissions. Critically, LLM output must be stored as suggestions only and must never automatically become official marks. Staff must explicitly accept or reject each suggestion. This human-in-the-loop requirement is a hard constraint, not a design preference. The marks table must maintain an audit trail recording who marked each answer, whether AI assistance was used, whether a suggestion was accepted, any override reason provided, and the previous score if the mark was changed.

**Notifications and Exports**

Staff must receive notifications when grading jobs complete or fail. Grade data must be exportable as CSV for downstream integration with institutional grade management systems.

### 3.1.2 Non-Functional Requirements

**On-Premise Deployability**

A primary constraint is that the platform must be deployable on-premise within institutional networks. Many secondary and tertiary institutions in Singapore operate under network policies that restrict or prohibit the transmission of student data to external cloud services. The system must therefore function without mandatory reliance on any third-party cloud infrastructure, though cloud deployment should remain an option.

**Concurrent Load**

The platform must support 50–200 students submitting answers simultaneously. This range reflects the typical size of a single cohort taking a timed laboratory assessment. The architecture must ensure that this level of concurrent HTTP traffic does not degrade response times to the point of disrupting the student experience.

**Cost Control for LLM Usage**

LLM API calls represent a variable operational cost. The architecture must include mechanisms to prevent runaway spending, such as rate limiting background job concurrency and tracking token usage and cost per grading job.

**Security**

All API endpoints must be protected by JWT authentication. The system must apply rate limiting to prevent abuse. Docker images must run as non-root users. CORS must be configured to restrict cross-origin access.

**Scalability**

The web server tier must support horizontal scaling via Kubernetes Horizontal Pod Autoscaler, allowing the platform to handle load spikes during peak assessment periods without manual intervention.

---

## 3.2 High-Level Architecture

The platform adopts a monolithic full-stack architecture within a single repository, separating concerns into a React single-page application (SPA) on the client side, a Hono HTTP server on the server side, and a PostgreSQL database as the persistence layer. Background processing for AI grading is handled by Graphile Worker, a PostgreSQL-native job queue that shares the same database connection. External services are limited to Supabase (for authentication in cloud deployments) and OpenAI, Anthropic, or Google (for LLM grading).

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│              React SPA (Vite + TanStack)                │
└──────────────────────────┬──────────────────────────────┘
                           │ REST (Bearer JWT)
                           ▼
┌─────────────────────────────────────────────────────────┐
│               Hono HTTP Server (Node.js)                │
│    Routes ─► Middleware (Auth/RBAC) ─► Handlers         │
│              Rate Limiting (1000/15min/IP)               │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
           ▼                          ▼
┌────────────────────┐   ┌───────────────────────────────┐
│   PostgreSQL DB    │   │     Graphile Worker            │
│  (Neon / on-prem)  │◄──│  Background Job Processor      │
│                    │   │  (AI Grading Queue)            │
└────────────────────┘   └───────────────┬───────────────┘
                                         │
                           ┌─────────────▼──────────────┐
                           │  OpenAI / Anthropic / Google (LLM) │
                           └────────────────────────────┘
```

### 3.2.1 Monorepo over Microservices

The decision to adopt a monorepo with a single deployable server rather than a microservices architecture was deliberate. The platform is developed by a single developer over a constrained academic timeline. Microservices introduce operational overhead — separate deployment pipelines, inter-service communication protocols, distributed tracing, and independent versioning — that would consume time better spent on feature development. More concretely, a monorepo allows TypeScript types and Zod validation schemas to be shared directly between the client and server without a separate package publication step. A request body type defined on the server can be imported directly by the client-side API wrapper, eliminating an entire class of type-mismatch bugs.

The trade-off accepted is that the client and server cannot be scaled independently. However, given that the server handles both API traffic and static file serving, and that Kubernetes HPA can scale the entire web pod horizontally, this limitation is acceptable within the platform's target load range of 200 concurrent users.

### 3.2.2 SPA over Server-Side Rendering

The platform renders entirely in the browser as a single-page application rather than using a server-side rendering (SSR) framework such as Next.js or Remix. This decision is justified on several grounds.

First, the platform is an internal tool accessed only by authenticated users. The primary motivation for SSR in modern web development — search engine optimisation and first-contentful-paint performance for public-facing pages — does not apply here.

Second, the interactive nature of the assessment-taking experience is well-suited to client-side state management. Auto-save timers, countdown clocks, focus monitoring event listeners, and answer draft buffering are all naturally expressed as client-side state and side effects. Implementing these in an SSR model would require hydration strategies that add complexity without benefit.

Third, by keeping the server as a pure REST API, the deployment model is simplified: the server serves JSON, and the built SPA is served as static files from the same container. This aligns well with the on-premise Docker deployment requirement.

---

## 3.3 Database Design

The database comprises 16 tables managed through Drizzle ORM using a schema-first approach. All schema changes are made in `src/db/schema.ts`, from which Drizzle generates SQL migration files. This approach ensures that the database schema is version-controlled alongside application code and that migrations are reproducible across environments.

### 3.3.1 Core Entity Relationships

```
users
  │
  ├──< enrollments >──── courses
  │                         │
  │                         └──< assignments
  │                                  │
  │                                  └──< assignmentQuestions >── questions
  │
  └──< submissions (assignment_id, user_id)
              │
              └──< answers (question_id)
                      │
                      ├── marks (markedBy, isAiAssisted, aiSuggestionAccepted)
                      └── aiGradingSuggestion (JSONB)

aiGradingJobs (submission_id, question_id, status)
aiUsageStats (date, provider, model — daily aggregates)
systemSettings (key-value, LLM provider config)
```

All tables carry `created_at` and `updated_at` timestamps. The `updated_at` field is updated manually within application code on every write operation, a deliberate choice to avoid database-layer triggers that would complicate migration portability across PostgreSQL variants (particularly managed services such as Neon).

### 3.3.2 JSONB for Flexible Question Content

Question types have fundamentally different content structures. An MCQ question requires a list of options with a correct-answer flag. A UML question requires a reference diagram, an expected element list, and a grading rubric. A coding question requires starter code templates per language and expected test cases. A written question requires only a rubric.

A normalised relational approach would require either a wide table with many nullable columns (one per question type's fields), or a set of type-specific child tables accessed via polymorphic joins. Both approaches impose schema migrations whenever a new question type is introduced or an existing type's content structure evolves.

The chosen approach stores question content in a PostgreSQL `jsonb` column. The structure of this JSONB payload is validated at the application layer using Zod schemas, one per question type. This pushes validation responsibility from the database to the application, which is a trade-off: the database cannot enforce content correctness in isolation. However, since all writes pass through the Hono server where Zod validation is applied before any database operation, the risk of invalid content reaching the database is minimal. The benefit is that adding a new question type or extending an existing type's content structure requires no database migration — only a schema update and a Zod schema revision.

### 3.3.3 PostgreSQL Enums for State Machines

Two state machines are enforced at the database level using PostgreSQL enums.

The submission lifecycle is modelled as:

```
draft ──► submitted ──► grading ──► graded
           │
           └──► late ──► grading ──► graded
```

The AI grading job status is modelled as:

```
pending ──► processing ──► completed
                │
                └──► failed
```

Using database-level enums rather than plain string columns serves two purposes. First, it prevents invalid states from being persisted even if application-layer validation is bypassed. Second, it communicates the valid state space to any developer inspecting the schema directly, without requiring reference to application code.

### 3.3.4 Cost Storage as String

Token cost values (in USD) are stored as `varchar` rather than `float` or `numeric`. Floating-point representations of decimal values introduce precision errors that accumulate across aggregation operations. While PostgreSQL's `numeric` type avoids this, it introduces complexity when serialising values to JSON for API responses, since `numeric` is represented as a string in the PostgreSQL wire protocol. Storing cost as a string from the outset makes the data flow consistent: the value is a string from storage through serialisation to display, and arithmetic is performed only when needed (at aggregation time in reporting queries, using `CAST` to `numeric`).

### 3.3.5 Soft Deletion via `deactivatedAt`

Rather than physically deleting user or question records, the schema uses a nullable `deactivatedAt` timestamp. This preserves referential integrity for historical submissions and grade records. A student whose account is deactivated mid-semester still has valid submission and mark records that must remain queryable for academic record purposes. Hard deletion would require cascading deletes or nullable foreign keys on submissions and marks, either of which would corrupt the historical record.

---

## 3.4 API Design

### 3.4.1 REST over GraphQL

The API follows REST conventions across approximately 15 route files, each corresponding to a resource (users, courses, assignments, questions, submissions, marks, and so forth). GraphQL was considered but rejected. The data access patterns on this platform are well-defined CRUD operations on known resources. GraphQL's primary value proposition — allowing clients to specify arbitrary query shapes to avoid over-fetching — applies most strongly when multiple client types with divergent data needs exist (for example, web and mobile clients). With a single SPA as the sole consumer, the overhead of a GraphQL schema, resolvers, and query parsing is unjustified.

### 3.4.2 Consistent Response Envelope

All API responses follow a uniform envelope:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "User-friendly message" }
```

This consistency means client-side error handling can be written once in the API wrapper (`src/client/lib/api.ts`) and applied uniformly. The `success` boolean allows the client to distinguish application-level errors (which carry a 200 status with `success: false`) from transport-level errors, though in practice the platform also uses HTTP status codes semantically: 201 for creation, 400 for validation failures, 401 for authentication failures, 403 for authorisation failures, 404 for missing resources, and 500 for internal errors.

### 3.4.3 Rate Limiting

A limit of 1,000 requests per 15-minute window per IP address is applied globally. This threshold is chosen to accommodate legitimate heavy usage (a student auto-saving every 30 seconds for a 2-hour exam generates 240 requests) while preventing trivial abuse. The limit is enforced at the middleware layer before any route handler executes, ensuring that even unauthenticated requests are bounded.

---

## 3.5 Authentication Architecture

### 3.5.1 Dual Authentication Paths

The platform supports two authentication mechanisms operating in parallel, implemented as a single middleware that attempts verification in order.

```
Incoming Request (Authorization: Bearer <token>)
              │
              ▼
  ┌─────────────────────┐
  │  Verify as Custom   │  ── success ──► attach user, proceed
  │  JWT (HS256, local) │
  └─────────┬───────────┘
            │ failure
            ▼
  ┌─────────────────────┐
  │  Verify as Supabase │  ── success ──► attach user, proceed
  │  JWT (remote JWKS)  │
  └─────────┬───────────┘
            │ failure
            ▼
         401 Unauthorized
```

Custom JWT tokens are issued by the platform's own login endpoint using a shared secret (HS256). Verification requires no network call and completes in microseconds. Supabase JWT tokens are issued by Supabase's authentication service and verified against Supabase's public JWKS endpoint. This verification is performed locally after the JWKS is fetched and cached.

The rationale for dual authentication is the on-premise deployment requirement. A school deploying the platform on its own infrastructure may not be permitted to route authentication traffic through Supabase's cloud service. In this scenario, the platform operates with custom JWTs only, using email and password authentication backed entirely by the local database. Conversely, a cloud deployment can leverage Supabase's full feature set, including magic links and OAuth providers. The dual-path architecture ensures the platform is viable in both environments without forking the codebase.

The accepted trade-off is that two authentication code paths must be maintained and tested. A bug in either path could result in either unauthorised access or legitimate users being rejected.

### 3.5.2 Role Inference from Email Domain

Upon first login via Supabase (where the platform does not control account creation), the platform infers a user's role from their email domain. Addresses matching the staff domain pattern are assigned the staff role; addresses matching the student domain pattern are assigned the student role; a configurable list of administrator email addresses are assigned the admin role. This approach removes the need for a separate onboarding flow or manual role assignment for the common case and reflects the existing identity infrastructure of the target institution (Nanyang Technological University), where staff and student email domains are structurally distinct.

### 3.5.3 Token Refresh with Deduplication

The client-side API wrapper includes a token refresh mechanism guarded by an `isRefreshing` flag. When a request receives a 401 response indicating token expiry, the wrapper initiates a refresh. Concurrent requests that also receive 401 during this window are queued rather than each independently triggering a refresh. This deduplication is important for the assessment-taking flow, where multiple simultaneous requests (auto-save, timer sync) could otherwise trigger a flood of refresh calls, creating a race condition in which multiple new tokens are issued and all but one are immediately invalidated.

---

## 3.6 AI Grading Pipeline Design

### 3.6.1 Pipeline Architecture

The AI grading pipeline is designed as an asynchronous, queue-based system to decouple the HTTP request-response cycle from the latency of LLM API calls, which can range from several seconds to over a minute for complex responses.

```
Staff triggers grading (HTTP POST)
          │
          ▼
API creates aiGradingJob records (status=pending)
API enqueues Graphile Worker tasks
          │
          ▼ (asynchronous)
Worker picks up task (status=processing)
          │
          ▼
Fetch: answer text, question, rubric, maxPoints
          │
          ▼
Call LLM via Vercel AI SDK generateObject()
with Zod schema: { points, reasoning, confidence, criteriaScores }
          │
          ├── success ──► clamp points to [0, maxPoints]
          │               store in answers.aiGradingSuggestion (JSONB)
          │               update aiGradingJob status=completed
          │               track token usage + cost
          │               notify staff
          │
          └── failure ──► update aiGradingJob status=failed
                          notify staff
                          │
                          ▼
                Staff reviews suggestion (human-in-the-loop)
                          │
                    ┌─────┴─────┐
                    ▼           ▼
                 Accept       Reject
                    │           │
                    ▼           └──► clear aiGradingSuggestion
             Create mark record
             (isAiAssisted=true,
              aiSuggestionAccepted=true)
```

### 3.6.2 Human-in-the-Loop as a Hard Requirement

The most significant design decision in the grading pipeline is the prohibition against automatic promotion of AI suggestions to official marks. LLM output is stored in a dedicated JSONB field (`answers.aiGradingSuggestion`) and is structurally separate from the `marks` table. A mark record is only created when a staff member explicitly accepts the suggestion or manually enters a score.

This decision reflects both academic integrity requirements and practical reliability concerns. LLMs, including state-of-the-art models, can produce plausible-sounding but incorrect assessments, particularly for domain-specific tasks like UML diagram evaluation where the model's reasoning about structural correctness may not align with the rubric's intent. Allowing AI scores to automatically populate grade records would expose the institution to challenges from students who received incorrect marks, with no human accountability in the chain.

The accepted trade-off is additional friction for staff: reviewing and accepting suggestions one by one adds steps to the grading workflow. This is mitigated by a batch-accept interface that allows staff to accept all suggestions for a submission at once, and by the confidence score in the LLM response, which allows staff to prioritise manual review of low-confidence suggestions.

The marks table maintains a full audit trail for every marked answer: the `markedBy` field records the staff member's user ID, `isAiAssisted` records whether an AI suggestion was present at the time of marking, `aiSuggestionAccepted` records whether the suggestion was accepted or the mark was entered independently, `overrideReason` captures the staff member's justification when they deviate from the suggestion, and `previousScore` records the prior mark if a score is revised. This audit trail supports academic appeals processes and provides transparency for institutional quality assurance reviews.

### 3.6.3 Graphile Worker at Concurrency=1

Background jobs are processed by Graphile Worker, a PostgreSQL-native job queue that uses advisory locks to claim jobs without requiring a separate queue service such as Redis or RabbitMQ. The worker is configured to process one job at a time (concurrency=1).

This concurrency setting is a deliberate cost control measure. LLM API pricing is token-based, and parallel requests multiply costs linearly. At concurrency=1, the cost of a grading batch is predictable and bounded: it is the sum of individual job costs processed sequentially. Parallelism would reduce wall-clock time for large batches but at the risk of exceeding API rate limits (which can cause failed requests that must be retried) and unpredictable cost spikes.

For the target use case — a cohort of 50–200 students, each with 3–10 questions — a batch of up to 2,000 grading jobs at concurrency=1 with an average LLM response time of 5–10 seconds would complete in two to six hours. Given that AI-assisted grading is positioned as an overnight or between-session tool rather than a real-time grading mechanism, this throughput is acceptable.

### 3.6.4 Structured Output via Vercel AI SDK

All LLM calls use the Vercel AI SDK's `generateObject()` function with a Zod schema specifying the expected response structure. This approach, rather than prompting the model to return JSON and then parsing it with `JSON.parse()`, has two advantages. First, the SDK instructs the model to use structured output mode (where supported) or function-calling, which significantly reduces the rate of malformed responses. Second, Zod validation at the application layer catches any response that does not conform to the schema before it reaches the database, preventing invalid suggestion data from being stored.

The response schema requires three fields: a `points` field (number, non-negative), a `reasoning` field (string, explaining the score), and a `confidence` field (number, 0–100). A `criteriaScores` array (one entry per rubric criterion with criterion name, score, and comment) is included as an optional field; when present, it provides the per-criterion breakdown surfaced in the staff grading interface. Points are additionally clamped to the question's `maxPoints` value after parsing, as a defensive measure against model hallucination producing out-of-range scores.

### 3.6.5 Provider Factory Pattern

The `getModel()` factory function returns a configured LLM provider instance based on the `systemSettings` table, which stores the active provider (OpenAI, Anthropic, or Google), the model identifier, and the API key. Switching between providers requires only a settings change through the admin interface; no code changes or redeployment are needed.

This design reflects a practical uncertainty: the optimal model for UML diagram assessment is not known in advance and may vary by question type, rubric complexity, or institution preference. The factory pattern enables controlled experimentation with different models without architectural changes. The same grading code path is exercised regardless of which provider is active, and token usage is tracked per-provider to allow cost comparison.

### 3.6.6 Prompt Versioning

Two prompt versions are maintained in code (`src/server/config/prompts.ts`): a `v1` prompt emphasising fair and partial-credit grading, and a `v2` prompt applying stricter interpretation of rubric criteria. Storing prompts in the codebase rather than in the database means prompt changes are version-controlled, reviewed via pull request, and tied to a specific deployment. Database-stored prompts would allow real-time modification without deployment but would make it harder to reason about which prompt version was active at a given point in time — a concern for academic audit trails.

---

## 3.7 Deployment Architecture

### 3.7.1 Docker Multi-Stage Build

The production Docker image is built in two stages. The first stage (builder) uses a full Node.js image to install dependencies, compile TypeScript, and bundle the React SPA. The second stage (production) copies only the compiled output and production dependencies into a minimal Alpine Linux base image. This approach produces a significantly smaller final image (approximately 200–300 MB compared to over 1 GB for a naive single-stage build), reducing both registry storage costs and container startup time.

The production container runs as a non-root user, a security baseline requirement for enterprise and institutional deployments where container security scanning tools flag root-running containers as policy violations.

### 3.7.2 Two-Container Service Model

The Docker Compose and Kubernetes manifests define two services from the same image: `web` (running the Hono HTTP server) and `worker` (running the Graphile Worker background processor). Both services share the same compiled codebase, avoiding the need to maintain a separate Dockerfile or build pipeline for the worker.

The separation of HTTP and worker processes is architecturally important. If the worker were embedded in the HTTP server process, a slow LLM API call could consume a thread-pool worker that would otherwise handle HTTP requests, degrading response times for students during an assessment. By running the worker as a separate process (and a separate Kubernetes Deployment), the two concerns are isolated: the HTTP server can be scaled horizontally without scaling the worker, and a worker crash does not affect the HTTP server.

### 3.7.3 Kubernetes Configuration

The `web` Deployment is configured with a Horizontal Pod Autoscaler (HPA) targeting CPU utilisation at 70%, scaling between 2 and 6 replicas. A minimum of 2 replicas provides basic redundancy: if one pod crashes during a student's active assessment session, the load balancer routes subsequent requests to the remaining pod. The 6-replica maximum is a cost ceiling; beyond this point, the bottleneck is likely the database connection pool rather than CPU, and horizontal pod scaling would not improve throughput.

The `worker` Deployment runs a single replica by default. Scaling the worker horizontally would require increasing the Graphile Worker concurrency setting, which would increase LLM API costs proportionally. Manual scaling is therefore preferred for the worker: an administrator can temporarily increase replicas during periods when a large grading backlog must be cleared quickly.

### 3.7.4 CI/CD Pipeline

The GitHub Actions pipeline runs on every push to the main branch. The pipeline stages are: lint (ESLint) → build (TypeScript compilation and Vite bundling) → Docker build and push to GitHub Container Registry (ghcr.io). Kubernetes manifests are updated with the new image tag, and a `kubectl rollout` is triggered against the target cluster. The pipeline uses repository secrets for the registry token and cluster credentials, ensuring that no sensitive values are embedded in the codebase.

---

## 3.8 Summary of Design Decisions

Table 3.1 consolidates the major architectural decisions made during the design of the platform, the alternatives that were considered, and the primary justification for each choice.

**Table 3.1: Summary of architectural design decisions**

| Decision | Chosen | Rejected Alternative | Primary Justification |
|---|---|---|---|
| Repository structure | Monorepo (single repo) | Monorepo with separate packages / microservices | Single developer; shared TypeScript types; simpler CI/CD pipeline |
| Rendering strategy | Client-side SPA | Server-side rendering (Next.js / Remix) | Internal tool (SEO irrelevant); interactive assessment UX suits client-side state |
| HTTP framework | Hono (Node.js) | Express, Fastify, Next.js API routes | Lightweight, TypeScript-native, works with Node.js and Bun; no framework lock-in |
| Database ORM | Drizzle ORM | Prisma, raw SQL, TypeORM | Schema-first, zero-runtime overhead, inferred TypeScript types from schema |
| Flexible content storage | PostgreSQL JSONB | Polymorphic relational tables, EAV pattern | Trivially extensible; no migrations for new question type fields; Zod validates at application layer |
| State machine enforcement | PostgreSQL enums | Application-only validation | DB-level enforcement prevents invalid states even with direct DB access |
| Job queue | Graphile Worker | Redis + BullMQ, RabbitMQ, AWS SQS | PostgreSQL-native; no additional infrastructure; ACID-safe job claims |
| Worker concurrency | 1 (sequential) | Higher concurrency (parallel LLM calls) | Predictable LLM API costs; avoids rate limiting; simpler error handling |
| AI grading model | Human-in-the-loop suggestions | Auto-promotion to official marks | Academic integrity; staff accountability; audit trail for appeals |
| LLM output parsing | generateObject() + Zod schema | Raw JSON prompt + JSON.parse() | Structured output reduces malformed responses; Zod validates before storage |
| LLM provider coupling | Provider factory (getModel()) | Hard-coded OpenAI calls | Runtime provider switching without code changes; cost experimentation |
| Authentication | Dual JWT (custom + Supabase) | Supabase-only, custom-only | On-premise deployability without Supabase; cloud deployments retain magic links and OAuth |
| Role assignment | Email domain inference | Manual admin assignment, SSO group claims | Zero-friction onboarding for typical institution email structure |
| API style | REST | GraphQL, tRPC | Well-defined CRUD patterns; single client consumer; lower complexity |
| Response format | { success, data, error? } envelope | Raw resource response, HTTP status only | Uniform client-side error handling; success flag decouples from HTTP status semantics |
| Frontend routing | TanStack Router (file-based) | React Router, Next.js pages | Type-safe routes with beforeLoad guards; co-located route and loader logic |
| Container strategy | Multi-stage Docker (Alpine) | Single-stage build | Smaller image size; non-root user for security compliance |
| Deployment topology | 2-service model (web + worker) | Embedded worker in HTTP server | Process isolation; independent scaling; worker crash does not affect HTTP availability |
| Database hosting | Neon PostgreSQL (serverless) | Self-hosted PostgreSQL, PlanetScale | Serverless scaling; compatible with on-premise override via DATABASE_URL |
| Cost tracking | Per-job token + cost storage, daily aggregates | No tracking | Institutional accountability; cost comparison across providers and models |
| Prompt management | Prompts in code (versioned) | Prompts in database (dynamic) | Version control; auditability of which prompt produced which grades |

The design decisions summarised above establish the structural and behavioural constraints within which the implementation described in Chapter 4 was carried out. Chapter 4 details how these design choices were realised in code, identifies the implementation challenges encountered, and documents the design patterns applied to manage complexity across the frontend, backend, and background processing components.