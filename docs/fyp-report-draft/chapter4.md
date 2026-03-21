# 4 Implementation

## 4.1 Technology Stack

The platform was built with a deliberate focus on end-to-end type safety, deployment simplicity, and long-term maintainability within an on-premise school environment. Each technology choice was evaluated against these constraints before adoption.

**Table 4.1: Technology stack**

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Language | TypeScript (strict) | 5.x | End-to-end type safety across client and server; shared type definitions eliminate a class of runtime bugs; strict mode catches implicit `any` and null hazards at compile time |
| Frontend runtime | React | 19 | Mature component model; hooks-based state management; large ecosystem of compatible libraries; concurrent features enable smoother UX during data fetching |
| Build tool | Vite | 7 | ESM-native bundler with sub-second hot module replacement; substantially faster than webpack-based alternatives during active development |
| Client routing | TanStack Router | 1.x | File-based, fully type-safe routing with automatic code splitting; route-level `beforeLoad` guards enable RBAC enforcement at the navigation layer without additional wrappers |
| Server state | TanStack Query | 5.x | Declarative server state caching with automatic deduplication of concurrent requests; configurable stale-time reduces unnecessary API calls; mutation callbacks keep the UI consistent after writes |
| Styling | Tailwind CSS | 4 | Utility-first approach enables rapid prototyping and consistent spacing/colour without maintaining a separate CSS file per component |
| UI primitives | Headless UI | 2.x | Accessible, unstyled components (dialogs, dropdowns, transitions) that integrate with Tailwind without overriding opinionated styles |
| Diagram editor | xyflow (React Flow) | 12.x | Interactive node-and-edge canvas with built-in drag, zoom, and connection logic; chosen over canvas-based alternatives because it exposes a React component API, keeping diagram state in the React tree |
| HTTP framework | Hono | 4.x | Lightweight, TypeScript-first framework with middleware chaining identical in form to Express but with first-class type inference on request/response; no unnecessary abstractions |
| ORM | Drizzle ORM | 0.x | Schema-first approach where `schema.ts` is the single source of truth; `$inferSelect` and `$inferInsert` eliminate manual DTO definitions; thin SQL abstraction gives predictable query plans |
| Database | PostgreSQL | 16 | JSONB columns provide schema-flexible storage for question content and rubrics without a separate document store; mature, well-understood semantics for transactions and indexes |
| Authentication | Supabase + jose | — | Supabase handles email/password and magic-link flows out of the box; `jose` provides local JWT verification for the custom authentication path, avoiding a network round-trip on every request |
| Job queue | Graphile Worker | 0.x | PostgreSQL-native queue; requires no additional infrastructure (no Redis, no RabbitMQ); jobs are durably persisted in the same database as application data |
| LLM SDK | Vercel AI SDK | 6.x | Provider-agnostic interface over OpenAI, Anthropic, and Google; `generateObject()` enforces structured JSON output validated against a Zod schema |
| Validation | Zod | 3.x | Runtime schema validation with TypeScript type inference; used for API request validation, LLM response parsing, and environment variable checking |
| Containerisation | Docker | 24.x | Single-image build including compiled server and bundled client assets; enables deterministic on-premise deployment without a Node.js version requirement on the host |
| CI/CD | GitHub Actions | — | Automated build, lint, and Docker image push to `ghcr.io` on every commit to main; image tags correspond to git SHA for traceability |

The deliberate absence of a separate caching layer (Redis) and a separate message broker (RabbitMQ) reflects the on-premise deployment constraint. Institutions running this platform on modest hardware should not be required to operate additional stateful services. Graphile Worker satisfies the job queue requirement using the PostgreSQL connection that is already mandatory, keeping the operational footprint to a single database.

---

## 4.2 Frontend Implementation

### 4.2.1 Feature-Based Module Architecture

The client source is organised into self-contained feature modules rather than a layer-by-layer structure (all components in one folder, all hooks in another). Each feature directory bundles its own components, hooks, and types:

```
src/client/features/
├── student-dashboard/
├── student-assignment/        # most complex feature
│   ├── hooks/
│   │   ├── useAssignmentData.ts
│   │   ├── useAnswerManagement.ts
│   │   └── useFocusMonitor.ts
│   ├── components/
│   └── types.ts
├── staff-course/
├── staff-grading/
└── staff-settings/
```

This structure makes the boundary of each feature explicit. When a staff member's grading view needs modification, the relevant code is isolated under `staff-grading/` rather than scattered across shared folders. The trade-off is occasional duplication of small utility functions across features, which was accepted in preference to premature abstraction.

### 4.2.2 Type-Safe Routing with Route Guards

TanStack Router's file-based routing was adopted principally for its `beforeLoad` hook, which enables RBAC enforcement at the router level. Every protected route declares its access policy before the component renders:

```typescript
export const Route = createFileRoute('/staff/courses/$courseId')({
  beforeLoad: ({ context }) => {
    const { dbUser } = context.auth;
    if (!dbUser || (dbUser.role !== 'staff' && dbUser.role !== 'admin')) {
      throw redirect({ to: '/login' });
    }
  },
  loader: ({ params }) => coursesApi.get(params.courseId),
});
```

Because the route definition and its type are co-located with the file, the router's type system catches broken parameter references at compile time. Code splitting is automatic: each route file becomes a separate bundle chunk, so students loading the assignment attempt page do not download the staff grading interface.

### 4.2.3 Authentication Context

A React Context (`AuthContext.tsx`) maintains unified authentication state across the application. The dual-auth architecture means a user may authenticate either via Supabase (magic links) or via a custom JWT (password login). The context normalises both paths into a single `dbUser` object:

```typescript
export type DbUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'staff' | 'student';
  supabaseId: string;
} | null;
```

On mount, the context checks `localStorage` for a custom token first; if absent, it falls back to the Supabase session. It subscribes to `supabase.auth.onAuthStateChange` so that token refresh events propagate to all consuming components without requiring manual polling. An admin impersonation feature — useful for testing student-facing flows without a separate browser session — is implemented by storing a `'uml-platform.adminViewAs'` preference in `localStorage`, which the context uses to override the effective role for routing decisions.

### 4.2.4 API Client

All HTTP calls pass through a centralised API client (`src/client/lib/api.ts`) that automatically injects the Bearer token from whichever authentication source is active:

```typescript
async function getAccessToken(): Promise<string | null> {
  const customToken = localStorage.getItem('uml-platform.customToken');
  if (customToken) return customToken;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
```

The client exposes named namespace objects (`coursesApi`, `submissionsApi`, `gradingApi`, and so on) rather than a single generic `fetch` wrapper. This provides a discoverable API surface: a developer building the grading dashboard can import `gradingApi` and use TypeScript autocompletion to find available operations. Concurrent token refresh attempts are deduplicated using a module-level promise, preventing multiple simultaneous `POST /api/auth/refresh` calls when several queries fire on initial page load.

### 4.2.5 Student Assignment Attempt

The student assignment attempt page is the most complex component in the system. It must simultaneously handle question navigation, answer persistence, timer countdown, focus monitoring, and submission confirmation while remaining robust to connectivity interruptions during an exam.

**Dirty-tracking auto-save.** Rather than debouncing saves on every keystroke — which would produce excessive API traffic during a written answer — the `useAnswerManagement` hook tracks which questions have unsaved changes using a `Set<string>` ref (`dirtyRef`). A `setInterval` every 30 seconds flushes all dirty question IDs silently in the background. Immediate saves are also triggered on question navigation and before submission:

```typescript
const updateAnswer = useCallback((questionId: string, answer: AnswerState) => {
  setAnswers(prev => ({ ...prev, [questionId]: answer }));
  dirtyRef.current.add(questionId);
}, []);

// Auto-flush every 30 seconds
useEffect(() => {
  const interval = setInterval(() => {
    const dirtyIds = Array.from(dirtyRef.current);
    dirtyIds.forEach(id => void saveAnswer(id, true));
  }, 30000);
  return () => clearInterval(interval);
}, [saveAnswer, submission, submitted]);
```

**Discriminated union for answer types.** Each answer type has a structurally distinct shape. A discriminated union enforces that the calling code handles every variant:

```typescript
export type AnswerState =
  | { type: 'written'; text: string }
  | { type: 'coding'; text: string }
  | { type: 'mcq'; selectedOptionIds: string[] }
  | { type: 'uml'; umlText: string; editorState?: ClassDiagramState };
```

The `saveAnswer` function switches on `answer.type` to construct the correct API payload for each variant, which the TypeScript compiler verifies is exhaustive. This pattern eliminates runtime errors caused by accessing `selectedOptionIds` on a written answer or vice versa.

**Focus monitoring.** When a staff member enables focus monitoring on an assignment, the `useFocusMonitor` hook attaches a `visibilitychange` listener to detect tab switches. Each departure–return pair is reported to the server as a focus event, which the server appends to the submission's `tabSwitches` JSONB column. If the reported count reaches the configured `maxTabSwitches`, the server's response includes `shouldAutoSubmit: true`, and the hook triggers immediate submission:

```typescript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    leftAtRef.current = new Date().toISOString();
  } else if (leftAtRef.current) {
    submissionsApi.reportFocusEvent(submissionId, { ... }).then(response => {
      if (response.data.shouldAutoSubmit) onAutoSubmit();
    });
    leftAtRef.current = null;
  }
});
```

**UML Editor.** The UML editing component offers three modes that students can switch between during an attempt: a visual canvas powered by xyflow where classes and relationships are manipulated by dragging and connecting nodes; a text editor accepting PlantUML notation for students who prefer a code-like input; and a preview mode that renders the PlantUML to a diagram image via a public rendering API. State is unified: editing in the visual mode updates the PlantUML text, and editing the PlantUML text updates the canvas layout on the next render. Both representations are persisted to the `answers.content` JSONB column so that graders can inspect either form.

---

## 4.3 Backend Implementation

### 4.3.1 Route Organisation

The server exposes approximately fifteen Hono route files, each responsible for a single resource: `courses`, `assignments`, `submissions`, `questions`, `grading`, `admin`, `settings`, `notifications`, and `auto-grade`, among others. Each file is between 200 and 400 lines and imports only the database tables and middleware it requires. This flat structure was preferred over a nested controller/service/repository layering because the application's complexity is horizontal (many resource types) rather than deep (many abstraction layers per resource).

All routes return the standard response envelope:

```typescript
{ success: true, data: { ... } }
// or
{ success: false, error: "Human-readable message" }
```

This uniformity means the API client can apply a single error-handling wrapper rather than per-endpoint parsing.

### 4.3.2 Authentication Middleware

The authentication middleware implements a two-path verification strategy motivated by the dual-auth requirement. Custom JWT verification is performed first because it is entirely local — it requires only an HMAC comparison against the server's `JWT_SECRET` and a single database row lookup to confirm the user still exists:

```typescript
async function tryCustomJwt(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.sub && payload.email)
      return { id: payload.sub, email: payload.email, role: payload.role };
    return null;
  } catch {
    return null;
  }
}
```

If the custom JWT path fails (because the token is a Supabase JWT), the middleware falls back to `supabase.auth.getUser(token)`, which makes an outbound network call to Supabase's verification endpoint. Although slower, this path is only taken when the institution uses Supabase-issued tokens. On first login via Supabase, if the user does not yet exist in the platform's `users` table, they are auto-provisioned with a role derived from their email domain (`@staff.main.ntu.edu.sg` → `staff`, `@e.ntu.edu.sg` → `student`). This automatic role inference removes the need for manual user provisioning after Supabase authentication.

Role-based access control is enforced through a `requireRole` middleware factory that is composed per route:

```typescript
export function requireRole(...allowedRoles: string[]) {
  return (c: Context<AuthContext>, next: Next) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    if (user.role === 'admin') return next();
    if (!allowedRoles.includes(user.role))
      return c.json({ error: 'Forbidden' }, 403);
    return next();
  };
}
```

### 4.3.3 Submission Lifecycle

Submissions traverse a deterministic state machine: `draft` → `submitted` (or `late` if past the due date) → `grading` → `graded`. The `draft` state is idempotent: if a student calls the start-attempt endpoint when a draft already exists, the server returns the existing draft rather than creating a duplicate. This is essential because page refreshes during an exam must resume the attempt, not open a new one.

MCQ auto-grading is synchronous at submission time. When the student submits, the server grades all MCQ answers immediately — applying the configurable per-wrong-selection penalty — and writes marks to the database in the same request. If the assignment contains only MCQ questions, the submission status advances directly to `graded` without ever entering `grading`. This design keeps the common case (pure MCQ tests) instant from the student's perspective while the LLM grading pipeline handles mixed and written assignments asynchronously.

Late penalty calculation is performed entirely server-side to prevent client manipulation. The penalty is parameterised by type (`none`, `fixed`, `per_day`, `per_hour`) and an optional cap:

```typescript
type LatePenaltyConfig = {
  type: 'none' | 'fixed' | 'per_day' | 'per_hour';
  value: number;  // percentage
  cap: number | null;  // maximum percentage
};
```

The penalty percentage and the calculation details (minutes late, raw score, adjusted score) are stored alongside the submission so that staff can audit why a deduction was applied.

---

## 4.4 LLM Integration and Prompt Engineering

### 4.4.1 Provider Factory

The LLM provider is selected at runtime through a factory function (`getModel()` in `src/server/lib/ai.ts`). Provider and model are read from the `systemSettings` database table, which can be updated by administrators through the settings UI. The retrieved values are cached in memory for 60 seconds to avoid a database read on every grading job:

```typescript
let settingsCache: { provider: string; model: string; lastFetch: number } | null = null;
const CACHE_TTL = 60000;

async function getLLMSettings() {
  if (settingsCache && Date.now() - settingsCache.lastFetch < CACHE_TTL) {
    return { provider: settingsCache.provider, model: settingsCache.model };
  }
  // ... DB read ...
  settingsCache = { provider, model, lastFetch: Date.now() };
  return { provider, model };
}

async function getModel() {
  const { provider, model } = await getLLMSettings();
  if (provider === 'anthropic') return anthropic(model);
  if (provider === 'google') return google(model);
  return openai(model);
}
```

Switching providers requires only a settings change: no code deployment is needed. This was an explicit requirement to allow institutions to substitute providers as pricing or data-residency policies change.

### 4.4.2 Structured Output with Zod

The Vercel AI SDK's `generateObject()` function was selected over free-form text generation precisely because grading requires a reliably parseable numeric score. Every grading job uses a shared Zod schema:

```typescript
const GradingResponseSchema = z.object({
  points: z.number().min(0).describe('Points awarded (0 to maxPoints)'),
  reasoning: z.string().min(10).describe('Detailed explanation of grading decision'),
  confidence: z.number().min(0).max(100).describe('Confidence level (0-100)'),
  criteriaScores: z.array(z.object({
    criterion: z.string(),
    score: z.number(),
    comment: z.string(),
  })).optional(),
});
```

The SDK instructs the model to produce output that conforms to this schema. As an additional defensive measure, the `points` field is clamped server-side after parsing in case the model returns a value exceeding the question's maximum:

```typescript
if (gradingResult.points > maxPoints) {
  gradingResult.points = maxPoints;
}
```

### 4.4.3 Prompt Design

Prompts are defined in `src/server/config/prompts.ts` and exist in two versioned forms, selectable via a `PROMPT_VERSION` environment variable. Version 1 (`v1`) positions the LLM as a fair academic assistant that awards partial credit and emphasises conceptual understanding. Version 2 (`v2`) configures a stricter posture that penalises missing technical terminology and incomplete coverage. Both versions include the same contextual information: the student's answer, the reference answer, the maximum points available, and, where provided, the rubric criteria with their individual point allocations.

For UML assignments, the text representation of the diagram — PlantUML notation — is embedded directly in the prompt rather than submitting the visual canvas state. This is because PlantUML is a standardised, token-efficient encoding that vision-capable models can reason about structurally. When a student submits a visual diagram, the system serialises the xyflow node-and-edge state into PlantUML before constructing the prompt. For image-based submissions, the model is first asked to extract the PlantUML structure from the image, then compare that extraction to the reference.

The UML v2 system prompt explicitly references UML 2.x notation compliance, design pattern recognition, and naming conventions. This reflects the assessment goal of the course: students are not only expected to model the domain correctly but to do so using standard UML idioms.

### 4.4.4 Cost Tracking

Every grading job records input and output token counts returned by the Vercel AI SDK. The `calculateCost` function in `src/server/config/pricing.ts` multiplies token counts by the per-million-token rates for the active provider and model. Costs are stored as six-decimal-precision strings rather than floating-point numbers to avoid IEEE 754 accumulation errors when summing daily aggregates:

```typescript
const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
const outputCost = (outputTokens / 1_000_000) * modelPricing.output;
return Number((inputCost + outputCost).toFixed(6));
```

Daily aggregates in the `aiUsageStats` table give administrators a running view of expenditure per provider and model, which is surfaced in the settings dashboard. This transparency was a requirement to make the platform adoptable by institutions operating under tight budget constraints.

---

## 4.5 Background Job Processing

### 4.5.1 Graphile Worker Architecture

All asynchronous work is handled by Graphile Worker, which stores job queues as rows in a dedicated PostgreSQL schema. Because the platform already depends on PostgreSQL, this adds no new infrastructure. The three registered task types are: `auto-grade-written` (LLM essay grading), `auto-grade-uml` (LLM UML diagram grading), and `auto-submit-expired` (timed-exam enforcement).

The worker process is compiled to a separate entry point (`src/server/worker.ts`) that registers the task list and starts the runner without binding any HTTP server:

```typescript
const taskList: TaskList = {
  'auto-grade-written': (payload, helpers) =>
    autoGradeWritten(payload as AutoGradeWrittenPayload, helpers),
  'auto-grade-uml': (payload, helpers) =>
    autoGradeUML(payload as AutoGradeUMLPayload, helpers),
  'auto-submit-expired': (payload, helpers) =>
    autoSubmitExpired(payload, helpers),
};
initializeWorker(taskList);
```

In the Docker and Kubernetes deployments, the worker runs as a separate container from the web server. This separation allows the grading pipeline to be scaled or restarted independently without affecting the HTTP-serving tier.

### 4.5.2 Concurrency and Cost Control

The worker is configured with concurrency equal to one. This decision was deliberate: LLM API calls are the most expensive operation in the system, and a sudden burst of concurrent grading jobs — such as when a lecturer triggers batch grading for an entire class — could produce an unexpectedly large API bill within minutes. Processing jobs serially introduces latency but bounds the rate of expenditure and respects provider rate limits without requiring a token-bucket implementation.

### 4.5.3 Auto-Submit Enforcement

The `auto-submit-expired` task is scheduled as a recurring cron job that fires every minute. It queries for draft submissions whose `startedAt + timeLimit` is in the past. For each expired submission, the job grades any MCQ answers synchronously, applies any applicable late penalty, transitions the submission to `submitted` (or `graded` if only MCQ questions were present), and sets `auto_submitted = true`. Staff enrolled in the course as lecturers, TAs, or lab executives receive a notification listing how many submissions were auto-submitted for each affected assignment. This server-side enforcement means timer accuracy does not depend on the student's browser remaining open, which is the correct behaviour for a proctored examination.

### 4.5.4 Job Failure Handling

If a grading job throws an exception, Graphile Worker marks the job as failed and Graphile's internal retry logic can be configured to re-attempt it. At the application level, the job handler updates the `aiGradingJobs` record with `status: 'failed'` and stores the error message and stack trace in the `error` JSONB column for post-mortem inspection. A staff notification is created immediately so that the responsible lecturer is made aware of the failure and can initiate manual grading. This two-pronged approach — automated notification plus a durable error record — ensures that a grading failure does not silently leave a student's submission in an ungraded state.

---

## 4.6 Key Design Patterns

### 4.6.1 Factory Pattern — LLM Provider Selection

The factory pattern encapsulates the construction of objects whose concrete type is determined at runtime. `getModel()` in `src/server/lib/ai.ts` is a textbook application: callers request an LLM model instance without knowing whether it will be an OpenAI, Anthropic, or Google implementation. Because the Vercel AI SDK exposes all three providers through an identical interface, the rest of the grading pipeline is entirely decoupled from the provider choice. Adding a further provider (for example, a locally-hosted model via an OpenAI-compatible endpoint) requires only a new branch in `getModel()`.

### 4.6.2 State Machine Pattern — Submission Lifecycle

The submission status column is constrained by a PostgreSQL enum (`submission_status`) and the server enforces valid transitions: a submission may not move from `draft` directly to `graded`, nor may a `graded` submission return to `grading`. Making transitions explicit in the database schema, rather than relying on application-layer bookkeeping, prevents concurrent requests from leaving a submission in an inconsistent state. The state machine pattern is directly beneficial to graders, who can filter submissions by status and trust that the status value accurately reflects what has happened.

### 4.6.3 Discriminated Union Pattern — Answer Types

TypeScript's discriminated unions provide exhaustiveness checking at compile time. The `AnswerState` type in the student assignment feature uses the `type` field as the discriminant. Every function that switches on `AnswerState.type` is checked by the compiler to handle all four variants (`written`, `coding`, `mcq`, `uml`). If a fifth question type were added in the future, every switch statement that does not handle it would produce a compile error, guiding the developer to all affected code paths.

### 4.6.4 Repository Pattern (API Client Namespaces)

The API client groups related operations into named objects that resemble repositories:

```typescript
export const coursesApi = { list, get, create, update };
export const submissionsApi = { start, save, submit, reportFocusEvent };
export const gradingApi = { getSubmissions, grade, bulkGrade };
```

This is not a strict implementation of the repository pattern (no interface or swappable implementation), but it achieves the practical goal: callers import only the namespace relevant to their feature, the namespace provides discoverable operations, and the token-injection logic is centralised in one place.

### 4.6.5 Observer Pattern — Auth State Changes

React Context combined with Supabase's `onAuthStateChange` callback implements the observer pattern for authentication events. The `AuthProvider` component subscribes to Supabase session changes on mount and propagates updates to all context consumers. This means that token expiry and refresh events are handled in a single location. Components do not need to manage their own session checking; they consume `dbUser` from context and react to its changes automatically.

### 4.6.6 Strategy Pattern — Late Penalty Calculation

The late penalty system supports four interchangeable algorithms: no penalty, a fixed percentage, a per-day accumulating penalty, and a per-hour accumulating penalty. Each is a distinct strategy for computing a deduction given the same inputs (minutes late, configured value, cap). The strategy is selected at call time from the assignment's `latePenaltyType` field. The Strategy pattern here directly serves the platform's goal of accommodating diverse institutional policies within a single codebase, without requiring code changes to adopt a new penalty scheme.

### 4.6.7 Command Pattern — Background Job Payloads

Each Graphile Worker task receives a typed payload object that encodes everything the task needs to execute independently of the caller:

```typescript
interface AutoGradeWrittenPayload {
  answerId: string;
  questionId: string;
  submissionId: string;
  userId: string;
  batchId?: string;
  jobId: string;
}
```

This payload is serialised to JSON and stored in the database queue. The task is durable: if the worker restarts mid-job, the payload can be re-read and execution restarted. By making the payload self-contained, the Command pattern enables the decoupling of the grading request (issued by an HTTP handler) from its execution (performed by the worker process, potentially minutes later).

---

## 4.7 Implementation Challenges

### 4.7.1 Dual Authentication Complexity

Supporting two independent authentication paths in the same codebase created several subtle issues. The most significant was token refresh during an active exam: a student who logs in via password and sits a two-hour exam will have their one-hour access token expire mid-attempt. The `api.ts` client detects 401 responses and automatically attempts to exchange the stored refresh token for a new access token before retrying the original request. To prevent multiple simultaneous 401 responses from triggering multiple concurrent refresh calls, a deduplication mechanism serialises all refresh attempts behind a shared promise.

Testing this code path required simulating token expiry in a controlled environment, which added meaningful overhead to the development cycle.

### 4.7.2 LLM Output Reliability

Despite the structured output mechanism, early testing revealed cases in which the LLM returned a `points` value fractionally above `maxPoints` (for example, `10.0001` for a 10-point question) due to floating-point rounding in the model's internal computation. A defensive clamp was added after parsing.

A separate category of failures involved the model producing a `reasoning` field shorter than the Zod minimum length constraint of 10 characters when the student's answer was very short (for example, a single word). These failures were mitigated by expanding the prompt to explicitly request a minimum explanation length regardless of answer length. Residual failures are handled by the job failure path, which notifies staff and stores the error for inspection.

### 4.7.3 Timer Synchronisation

The client-side countdown timer is initialised from `submission.startedAt` and the assignment's `timeLimit`, comparing against the local browser clock. Over a long exam, browser clock drift can accumulate to several seconds, and the client's countdown may reach zero slightly before or after the server-computed deadline. The auto-submit cron job serves as the authoritative enforcement mechanism, but it runs on a one-minute polling interval, meaning there is a window of up to 60 seconds in which a student whose timer has reached zero client-side may still be able to submit answers. This was accepted as a known limitation: the gap is small enough to be inconsequential in practice, and eliminating it would require a WebSocket-based real-time signal, which was deemed out of scope for the current iteration.

### 4.7.4 Focus Monitoring False Positives

The `visibilitychange` event fires in circumstances beyond intentional tab switching: operating system notifications that briefly steal focus, screen saver activation, and interactions with browser extensions all trigger the event. This means the tab-switch counter can be incremented by benign actions beyond the student's control. The platform mitigates this by applying a threshold: `maxTabSwitches` is configurable per assignment, and the recommended default is higher than one to accommodate occasional false positives. Staff can also inspect the `tabSwitches` JSONB array on a submission, which records the timestamp and duration of each focus event, enabling manual review of borderline cases.

### 4.7.5 JSONB Schema Evolution

Several database columns — `answers.content`, `questions.content`, `submissions.tabSwitches` — store structured data as PostgreSQL JSONB. Because JSONB imposes no schema constraints, changes to the expected structure (for example, adding a field to the UML answer format) must be handled entirely in application code. The platform uses Zod schemas and utility functions (`getAnswerContent`, `getQuestionContent`) to parse JSONB at the boundary between the database and the application layer, applying defaults for missing fields and rejecting malformed data with a descriptive error. This pattern localises JSONB parsing logic to a small number of utility files, making schema evolution changes traceable to a single location per content type.

With the platform implemented and deployed, Chapter 5 turns to the empirical dimension of the project: a controlled multi-model experiment that evaluates the suitability of ten LLMs across three providers for automated UML class diagram grading, directly exercising the grading pipeline described in Sections 4.4 and 4.5.
