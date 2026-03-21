# 6 Testing and Evaluation

## 6.1 Testing Strategy

A coherent testing strategy must balance coverage, maintainability, and the practical constraints of a single-developer academic project. The strategy adopted for this platform is organised into four levels, each serving a distinct verification purpose.

**Unit tests** verify the correctness of isolated logic units — grading calculations, penalty computation, schema validation — without any database or network dependency. These tests run in under a second each and are the first line of defence against regressions during active development.

**Integration tests** verify that API route handlers behave correctly when composed with their middleware, validation, and database access code. The database layer is replaced with a deterministic mock, allowing routes to be exercised end-to-end through the Hono request pipeline without a live PostgreSQL connection. This allows the full request-response cycle, including authentication checks, error handling, and response envelopes, to be verified in a controlled environment.

**Smoke tests** verify that the most critical system paths are operational after integration, covering the health endpoint, authentication, course access, grading dashboard, and database connectivity.

**End-to-end (E2E) tests** use Playwright to drive a real browser against the full running application, verifying user-facing flows that span client and server. These tests represent the highest-fidelity verification of the system but require a running server and seeded database to execute.

**Stress tests** probe the system's behaviour under concurrent load — concurrent login requests, parallel grading operations, and bulk enrolment processing — using the same in-process mock infrastructure as the integration tests.

All tests except the Playwright E2E suite are written in Vitest and run in CI via the GitHub Actions pipeline. The test infrastructure lives in `src/test/`, with four subdirectories corresponding to the integration, regression, smoke, and stress categories. Playwright tests reside in the top-level `e2e/` directory.

The chosen toolset reflects practical constraints. Vitest was selected because it integrates natively with the project's TypeScript and ESM configuration, runs tests in parallel by default, and provides first-class mocking support through `vi.mock()`. Playwright was selected for E2E testing because it offers a reliable browser automation API, built-in retry logic for flaky assertions, and a Page Object Model pattern that keeps test code maintainable. Both tools are standard in the TypeScript ecosystem and well-suited to the project's stack.

A significant testing challenge in this codebase is the dual authentication path (`src/server/middleware/auth.ts`). Tests must mock both the Supabase path and the custom JWT path independently to verify that each functions correctly in isolation and that neither path creates a security bypass. The test suite addresses this by injecting test users via an `X-Test-User` HTTP header in in-process tests, bypassing the real authentication middleware while preserving all downstream route behaviour.

---

## 6.2 Unit Testing

Unit tests target pure logic that can be verified without external dependencies. The primary subjects are the MCQ grading library, late penalty calculation, schema validation, and background job error handling.

### 6.2.1 MCQ Grading and Penalty Computation

MCQ auto-grading is a synchronous operation that must produce deterministic results: given a set of selected option IDs and a question's correct-answer configuration, the grading function returns a point value and feedback. The logic is non-trivial because it must handle partial selection (not all correct options chosen), over-selection (incorrect options chosen alongside correct ones), and the configurable `mcqPenaltyPerWrongSelection` deduction.

Unit tests verify that:
- All correct options selected with no incorrect options yields full marks.
- Missing one correct option reduces the score proportionally.
- Selecting an incorrect option applies the configured penalty per wrong selection.
- The resulting score is clamped to zero and cannot go negative.

Late penalty computation is tested against all four strategy variants (`none`, `fixed`, `per_day`, `per_hour`) with and without a cap. The tests verify that:
- The `none` strategy returns zero penalty regardless of minutes late.
- The `per_day` strategy increments the penalty on each full calendar day past the due date.
- The `per_hour` strategy increments per full hour, not per partial hour.
- The cap is applied correctly when the accumulated penalty would exceed it.

Late penalty is calculated server-side at submission time (`src/server/routes/submissions/submit-submission.ts`). Calculating it on the server prevents client-side manipulation of the penalty value, and unit testing this logic in isolation allows edge cases — for example, a student submitting exactly at the due date boundary — to be verified without the complexity of constructing a full HTTP request.

### 6.2.2 Schema Validation

The platform uses Zod schemas throughout (`src/server/lib/validation-schemas.ts`) to validate API request bodies before any database operation is attempted. Unit tests verify that:
- Valid request shapes pass validation and return the typed data.
- Missing required fields produce descriptive validation errors.
- Fields with incorrect types are rejected.
- Optional fields with defaults are populated correctly when absent.

Schema validation tests are particularly important for the grading-related schemas, where incorrect field types — for example, a string where a number is expected for `points` — would propagate silently to the database without Zod's runtime check.

### 6.2.3 B-Group Schema Tests

A distinct group of unit tests (the `b-group` in `src/test/b-group/`) verifies database schema correctness at the Drizzle layer. These tests import the Drizzle table definitions directly and assert that expected columns exist with the correct names and nullability constraints. For example, the grade override audit trail test (`b7-grade-override.test.ts`) verifies that `marks.overrideReason`, `marks.previousScore`, and `marks.overriddenAt` are all defined as nullable columns — a structural requirement for the override workflow, since these fields are only populated when a staff member revises a mark. Testing schema structure in this way catches accidental regressions where a migration removes or renames a column that application code depends on.

---

## 6.3 Integration Testing

Integration tests verify full request-response cycles through the Hono route handlers. They use a chainable proxy pattern to mock the Drizzle ORM query builder, allowing individual database queries to return pre-configured result sets in sequence. This approach tests the route logic, middleware composition, authentication checks, and error handling without a live database connection.

### 6.3.1 Authentication Flow (T9)

The authentication integration tests (`src/test/integration/auth-flow.test.ts`) cover the password login, forgot-password, reset-password, and current-user (`/me`) endpoints.

Key cases verified:
- A valid email/password pair returns a JWT token and the user object with the correct role.
- An invalid password returns HTTP 401 with the message `Invalid email or password`. Crucially, the same error is returned for both a wrong password and a non-existent email, preventing user enumeration — a security property verified explicitly by a test case.
- A deactivated user (`deactivatedAt` is non-null) receives HTTP 401 with the message `Account deactivated` before password comparison is attempted.
- The forgot-password endpoint returns a success response regardless of whether the email exists, and the email is not sent for non-existent addresses. This preserves the same enumeration-prevention guarantee.
- The password-reset endpoint rejects expired or already-used tokens with HTTP 400.
- The `/me` endpoint returns 401 for unauthenticated requests and returns the full user object for authenticated ones.

### 6.3.2 Submission Lifecycle (T10)

The submission lifecycle tests (`src/test/integration/submission-lifecycle.test.ts`) cover the three core submission endpoints: start, save-answer, and submit.

**Start submission**: The tests verify that starting a new attempt creates a draft submission with HTTP 201, that starting when a draft already exists returns the existing draft with HTTP 200 (idempotency), that a student who is not enrolled receives HTTP 403, that an assignment not yet open returns HTTP 403, and that reaching the maximum attempt count returns HTTP 400.

**Save answer**: The tests verify that saving an answer to a draft submission creates a new answer record (HTTP 201) or updates an existing one (HTTP 200 — upsert behaviour). Attempting to save an answer to a submission that is no longer in `draft` status returns HTTP 400 with the message `Cannot modify submitted assignment`. Attempting to save to another student's submission returns HTTP 403 with `Not your submission`, verifying ownership enforcement.

**Submit submission**: The tests verify that submitting a draft with MCQ questions triggers synchronous grading — confirmed by asserting that `gradeMcqAnswer` is called — and that the submission transitions directly to `graded` if all questions are MCQ. When non-MCQ questions exist, the submission transitions to `submitted` (awaiting LLM grading). Late submission detection is verified by constructing scenarios where `startedAt + timeLimit` is in the past at submission time. Re-submitting an already-submitted submission returns HTTP 400.

### 6.3.3 Role-Based Access Control (T11)

The RBAC integration tests (`src/test/integration/rbac.test.ts`) verify that the `requireRole` middleware correctly enforces access restrictions. Tests confirm that:
- A student attempting to access a staff-only endpoint receives HTTP 403.
- An unauthenticated request to any protected endpoint receives HTTP 401.
- An admin receives access to all endpoints regardless of the role requirement, reflecting the admin bypass logic in `requireRole`.
- A staff member can access staff endpoints but not admin-only endpoints.

### 6.3.4 Grading Pipeline (T12)

The grading pipeline regression tests (`src/test/regression/grading-pipeline.test.ts`) exercise the `auto-grade-written` and `auto-grade-uml` Graphile Worker task handlers, the accept/reject routes, and the batch-accept route.

**Written answer grading**: The tests verify that a successful LLM response is parsed, stored in `answers.aiGradingSuggestion`, and logged with the score. A critical regression test verifies the point-clamping behaviour: when the LLM returns a `points` value of 15 for a 10-point question (as has been observed with floating-point rounding in model outputs), the system clamps the score to 10 and logs a warning — rather than storing an invalid score. Another regression test verifies that a Zod validation failure from the LLM SDK propagates as an error, triggers the failure notification, and marks the job as `failed`.

**UML diagram grading**: The UML job handler is tested similarly, with the additional case that when a question has an empty `modelAnswer` field, the system falls back to the `referenceDiagram` field rather than failing. A missing UML text in the student's answer and a missing reference diagram both produce descriptive error messages.

**Accept/Reject workflow**: Tests confirm that accepting an AI suggestion creates a mark record with `isAiAssisted: true` and `aiSuggestionAccepted: true`, that rejecting a suggestion with a manual score creates a mark with `aiSuggestionAccepted: false`, and that attempting to accept when no suggestion exists returns HTTP 400.

**Batch accept**: Tests verify that the batch-accept route creates marks for multiple answers in a single request, skips answers that already have marks (returning a `skipped` count), rejects an empty `answerIds` array, and denies access to students (HTTP 403).

---

## 6.4 End-to-End Testing

The Playwright E2E test suite (`e2e/student-assignment-flow.spec.ts`) covers the primary student-facing user flow against a fully running application with a seeded database. Tests use the Page Object Model pattern to separate navigation logic from assertion logic, improving maintainability as the UI evolves.

The suite uses three Page Objects: `LoginPage` (navigates to the root, fills credentials, clicks the sign-in button), `StudentDashboard` (asserts the course list is visible or an empty state is shown), and `AssignmentPage` (selects MCQ options, fills written answers, submits, and confirms).

**T16-1 — Login and course list**: The student logs in with seeded credentials and the dashboard must display either course cards or an empty-state message within 10 seconds. This verifies that the authentication flow (JWT issuance, redirect, course query) completes end-to-end.

**T16-2 — Assignment navigation**: After login, the student navigates to a course and opens an assignment. The test verifies that question content renders within the assignment page, confirming that the full chain from route navigation through API calls to component rendering works correctly.

**T16-3 — Auto-save persistence**: The student selects an MCQ option, waits two seconds for the auto-save interval to trigger, refreshes the page, and asserts that the checked option is still selected. This is the most behaviourally significant E2E test: it validates the `useAnswerManagement` hook's dirty tracking, the auto-save API call to `POST /:submissionId/answers`, and the answer hydration logic that populates selections from the resumed draft on page load.

**T16-4 — Written answer persistence**: A similar persistence test for written answers — the student types a response, waits for auto-save, refreshes, and asserts the textarea still contains the typed text.

**T16-5 — Submission and re-entry prevention**: The student submits the assignment, confirms the submission dialog, and asserts that a confirmation message is shown. The test then asserts that the submit button is either disabled or absent, preventing re-submission.

**T16-6 — Timer display**: For timed assignments, the test verifies that a timer element is visible after starting the attempt. Full timer expiry and auto-submit are not exercised in the automated suite due to the time involved; this scenario is covered by the integration-level mock and by manual testing.

**T16-7 — Results viewing**: After navigating to a graded assignment, the test checks for the presence of a grade display element. This test is written to pass in either state (grades published or pending), reflecting that test execution order cannot guarantee the assignment has been graded before this test runs.

A known limitation of the E2E suite is that it requires a live server and seeded database, which was available in the development environment but is not yet wired into the CI pipeline due to the overhead of standing up a PostgreSQL instance in GitHub Actions. The suite is therefore run manually as part of the supervisor demonstration process rather than automatically on every commit.

---

## 6.5 Functional Requirements Evaluation

The following table maps each functional requirement from Section 3.1.1 to the evidence that it has been met, drawing on the implemented codebase, test results, and observed behaviour during demonstration.

| FR | Requirement | Verification Method | Status |
|---|---|---|---|
| FR-1 | Three global roles: admin, staff, student | RBAC integration tests (T11); `requireRole` middleware in `src/server/middleware/auth.ts` | Met |
| FR-2 | Course-scoped roles: lecturer, TA, lab_exec | `enrollments` table schema; course-scoped role checks in grading routes | Met |
| FR-3 | Individual and bulk CSV enrolment | `POST /api/courses/:id/enroll` and `POST /api/courses/:id/bulk-enroll`; demonstrated with 50-row CSV | Met |
| FR-4 | Question pool with four question types | MCQ, written, coding, UML types in `questions.type` enum; JSONB content validated per type | Met |
| FR-5 | Tag-based question organisation | `questionTags` join table; tag-based filtering on question pool API | Met |
| FR-6 | Assignment builder with configurable parameters | Time limit, max attempts, late penalty type/value/cap, shuffling, focus monitoring — all stored in `assignments` table | Met |
| FR-7 | Student auto-save every 30 seconds | `useAnswerManagement` hook with `setInterval(30000)`; verified by E2E auto-save persistence test (T16-3) | Met |
| FR-8 | Server-side timer enforcement via auto-submit | `auto-submit-expired` cron job in Graphile Worker; queried every minute | Met |
| FR-9 | Focus monitoring with configurable threshold | `useFocusMonitor` hook; `visibilitychange` events reported to server; `shouldAutoSubmit` flag in response | Met |
| FR-10 | Submission state machine: draft → submitted/late → grading → graded | PostgreSQL enum constraint; state transitions verified in lifecycle integration tests (T10) | Met |
| FR-11 | Synchronous MCQ auto-grading on submission | `gradeMcqAnswer` called within submit handler; verified by integration test confirming direct `graded` status | Met |
| FR-12 | LLM suggestions stored separately from official marks | `answers.aiGradingSuggestion` (JSONB) structurally distinct from `marks` table; accept/reject routes create mark records | Met |
| FR-13 | Human-in-the-loop: staff must explicitly accept or reject | No code path promotes AI suggestion to mark without staff action; verified by accept/reject integration tests (T12) | Met |
| FR-14 | Grade audit trail: markedBy, isAiAssisted, overrideReason, previousScore | `marks` table schema; B7 schema tests verify nullable override columns exist | Met |
| FR-15 | Staff notifications on grading completion/failure | `notifyGradingFailed` called in job failure path; batch completion notification verified in T12 | Met |
| FR-16 | Grade CSV export | `GET /api/courses/:id/grades/export` returns CSV; demonstrated with real course data | Met |
| FR-17 | Admin user management with bulk import | `POST /api/users/bulk-create`; CSV parsing with per-row error reporting | Met |
| FR-18 | Admin LLM provider configuration | `systemSettings` table; settings UI allows provider/model switching without redeployment | Met |

All eighteen functional requirements identified in Chapter 3 are assessed as met. The primary caveat applies to FR-4 (four question types): while MCQ, written, and UML are fully implemented with grading support, the coding question type has its content structure defined and renders in the assignment interface, but automated grading for coding answers is not yet implemented. Coding answers are assigned to staff for manual grading.

---

## 6.6 Non-Functional Requirements Evaluation

### 6.6.1 Performance

The non-functional requirement specified in Section 3.1.2 requires support for 50–200 students submitting answers simultaneously. The stress test (`src/test/stress/concurrent-submissions.test.ts`) simulates 50 concurrent login requests within the in-process Hono application, verifying that all 50 requests receive a response with no hanging or timeout. A separate concurrent MCQ grading test confirms that 50 parallel grading operations produce no shared-state corruption — each operation returns a distinct result without cross-contamination.

In the development environment with a locally-hosted Neon PostgreSQL instance, API response times for the auto-save endpoint (`POST /:submissionId/answers`) were consistently under 200 milliseconds for a single request. Under the concurrent test, all 50 requests completed within the 30-second test timeout. These figures are representative of the in-process test environment; real-world latency would be higher depending on database round-trip time and network conditions.

A known performance limitation is the auto-submit cron job's one-minute polling interval. There is a window of up to 60 seconds between client-side timer expiry and server-enforced submission. This was accepted as a design trade-off in favour of simplicity over the alternative of WebSocket-based real-time timer synchronisation, as documented in Section 4.7.3.

The LLM grading pipeline intentionally operates at concurrency=1, which means batch grading throughput is bounded by the average LLM response time. For a class of 50 students with 5 written questions each (250 grading jobs), at an average response time of 8 seconds per job, the total grading time is approximately 33 minutes. For the platform's target use case — grading run between sessions rather than in real-time — this throughput is acceptable.

### 6.6.2 Security

Security controls were evaluated against the four requirements stated in Section 3.1.2.

**JWT authentication on all endpoints**: Verified by the RBAC integration tests, which confirm that every protected route returns HTTP 401 for requests without a valid token. The dual-auth middleware (`src/server/middleware/auth.ts`) was also tested for the enumeration-prevention property in the authentication flow tests.

**Rate limiting**: The platform applies a limit of 1,000 requests per 15-minute window per IP via `hono-rate-limiter`. This limit accommodates a student auto-saving every 30 seconds during a 2-hour exam (240 requests) while bounding abuse attempts. The rate limiter is applied at the middleware layer before any route handler, including unauthenticated endpoints.

**Non-root Docker container**: The production Dockerfile runs as a non-root user (`USER node`), satisfying institutional container security scanning requirements. This was verified by inspecting the running container's process with `ps aux`.

**CORS configuration**: The Hono server restricts cross-origin requests to the configured `VITE_APP_URL` origin. Cross-origin requests from other domains receive a CORS rejection at the preflight stage.

One security limitation worth noting is that the focus monitoring mechanism relies on client-side browser events, which can be suppressed by browser extensions or developer tools. The threshold-based approach (`maxTabSwitches`) mitigates this but does not eliminate the possibility of a determined student evading detection. This limitation is inherent to browser-based proctoring and is acknowledged in the platform's documentation.

### 6.6.3 Usability

Usability was evaluated through supervisor review sessions and self-assessment against standard usability heuristics.

**Student interface**: The assignment attempt page displays a persistent question navigator showing answered, unanswered, and current question states. Auto-save is silent (no toast on every save) to avoid distracting students during timed assessments, while the `beforeunload` warning ensures students are notified if they attempt to close the browser with unsaved changes. MCQ options are clearly presented with accessible markup (radio buttons for single-select, checkboxes for multi-select).

**Staff interface**: The grading dashboard uses a two-panel layout — submission list on the left, grading form on the right — allowing staff to navigate through submissions without losing context. AI suggestions are visually distinguished from official marks, with accept and reject actions requiring explicit button clicks. The confidence score returned by the LLM is surfaced alongside the suggestion, allowing staff to prioritise low-confidence suggestions for more careful review.

**Admin interface**: Bulk user creation via CSV provides line-level error reporting, so an administrator uploading a roster with malformed rows receives specific feedback on which rows failed and why, rather than a blanket failure.

A usability limitation identified during supervisor review was the UML question type's reliance on PlantUML text notation. Students unfamiliar with PlantUML syntax face a learning curve that is extrinsic to the assessment objective. The visual canvas editor (powered by xyflow) partially addresses this, but its implementation is incomplete for complex class diagram scenarios such as interface inheritance and dependency relationships.

### 6.6.4 Scalability and Deployability

**Kubernetes HPA**: The Kubernetes deployment (`k8s/`) configures a Horizontal Pod Autoscaler for the web tier, targeting 70% CPU utilisation with a minimum of 2 replicas and a maximum of 6. This was verified by reviewing the HPA manifest and confirming that the `web` deployment and `worker` deployment are separate, allowing the HTTP-serving tier to scale independently of the background job processor.

**Docker deployment**: The multi-stage Docker build produces a production image that bundles both the compiled Hono server and the Vite-built SPA. The image is published to `ghcr.io` via GitHub Actions on every push to main. On-premise deployment requires only `docker pull` and the environment variables from `.env.example` — no Node.js installation or build tooling on the host.

**Database portability**: The platform uses standard PostgreSQL features — no proprietary extensions. The `DATABASE_URL` environment variable allows the platform to connect to any PostgreSQL-compatible service, including a self-hosted instance for on-premise deployments or Neon for cloud deployments.

A scalability limitation is that the `worker` deployment defaults to a single replica. Scaling the worker horizontally increases LLM API throughput proportionally but also increases cost. This trade-off is intentional: the platform treats AI grading as a batch operation where cost predictability is more important than throughput.

---

## 6.7 User Acceptance Testing

The platform was demonstrated to the supervising academic, Dr. Loke Kar Seng, across two sessions during the development cycle.

### 6.7.1 First Review Session

The first review session was conducted after the completion of Phase 2 (the core learning loop: CRUD operations, submission lifecycle, auto-save, and the question pool). The demonstration covered:
- Admin creating a user account and assigning it the staff role.
- Staff creating a course, adding questions to the pool, and building an assignment with a time limit and late penalty.
- Student logging in, starting the assignment, answering questions with auto-save active, and submitting.
- Staff accessing the grading dashboard and manually entering marks.

Feedback from this session highlighted that the assignment timer was not visually prominent enough and that the question navigator did not clearly distinguish between answered and unanswered questions at a glance. Both issues were addressed before the second session: the timer was moved to the header bar with a contrasting colour, and the question navigator was updated to use distinct visual states (green for answered, grey for unanswered, blue for current).

### 6.7.2 Second Review Session

The second review session covered the LLM-assisted grading pipeline and the AI usage statistics dashboard. The demonstration showed:
- Staff triggering batch AI grading for a set of written answers.
- The grading jobs appearing in the queue with `pending` status and transitioning to `completed`.
- Staff reviewing the AI suggestions in the grading panel — confidence scores, per-criterion breakdowns, and reasoning text.
- Staff accepting one suggestion, rejecting another with a manual score override, and viewing the resulting audit trail.
- Admin viewing the daily token usage and estimated cost in the settings dashboard.

The supervisor's primary feedback from this session concerned the transparency of the AI grading rationale. The initial implementation displayed only the overall `points` and `reasoning` fields from the LLM response. Following the review, the per-criterion `criteriaScores` breakdown was surfaced in the grading UI, allowing staff to see exactly which rubric criteria the model allocated points to. This change made the AI's reasoning more auditable and directly relevant to the human-in-the-loop requirement.

A secondary piece of feedback concerned the notification system: the 30-second polling interval meant there was a visible delay between a grading job completing and the notification appearing. This was noted as a known limitation tied to the absence of WebSocket support, and was accepted for the current iteration with a recommendation to implement Server-Sent Events in a future version.

### 6.7.3 Summary of Acceptance Outcomes

The table below summarises the supervisor feedback and the platform's response.

| Feedback Item | Source | Action Taken |
|---|---|---|
| Timer not visually prominent | Session 1 | Moved to header with contrasting colour |
| Question navigator states unclear | Session 1 | Distinct visual states: green / grey / blue |
| AI reasoning not granular enough | Session 2 | Per-criterion `criteriaScores` surfaced in grading UI |
| Notification polling delay | Session 2 | Documented as known limitation; SSE recommended for future work |
| UML input requires PlantUML knowledge | Session 2 | Visual canvas editor available; PlantUML documented for students |

Overall, the supervisor assessed the platform as meeting the functional scope of the FYP and providing a credible demonstration of LLM-assisted UML grading within an academic context. The audit trail and explicit acceptance workflow were specifically noted as the features most directly relevant to real institutional deployment.

---

## 6.8 Summary

This chapter has presented the testing strategy, test results, requirements verification, and user acceptance outcomes for the UML Assessment Platform.

The test suite comprises integration tests covering authentication, submission lifecycle, RBAC, and the grading pipeline (T9–T12); smoke tests confirming critical system paths; stress tests for concurrent load; and Playwright E2E tests for the primary student user flow (T16-1 through T16-7). All eighteen functional requirements are assessed as met, with the caveat that automated grading for coding-type questions is not yet implemented. Non-functional requirements for security, deployability, and scalability are met at the levels appropriate for the platform's target scale of 50–200 concurrent students.

The key quality trade-off in this platform is the human-in-the-loop grading model. By requiring staff to explicitly accept or reject every AI suggestion, the platform sacrifices automation speed in favour of academic integrity and staff accountability. This trade-off was validated in both supervisor review sessions, where the audit trail and explicit acceptance workflow were identified as the features most directly relevant to real institutional deployment.

Chapter 7 synthesises the outcomes of both the engineering and empirical strands of the project, situates the contributions against the five formal objectives stated in Section 1.3, and identifies the most productive directions for future work.
