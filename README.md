# UML Assessment Platform

Full-stack web platform for automated assessment of UML diagrams with LLM-assisted grading. Built as the deliverable for **NTU CCDS FYP project CCDS25-0233** (Wang Yu Teng, U2122796L · Supervisor: Dr. Loke Yuan Ren · Examiner: Prof. Zhang Hanwang).

The system supports the end-to-end assessment lifecycle — course setup, question authoring, timed student attempts, AI-assisted grading with human-in-the-loop review, and analytics — and embeds an empirically validated dual-modality grading pipeline.

> **Headline empirical result.** Across 6 frontier LLMs × 32 submissions × 5 runs (960 API calls), **Claude Opus 4.6** leads with **Pearson r = 0.92** and **MAE = 0.68 / 10** against single-grader ground truth. This improves on Bouali et al.'s ICC = 0.76 with earlier-generation models. Full methodology and per-RQ results are in [`experiment/`](experiment/) and [the FYP report](fyp-report/Wang_Yu_Teng_FYP_Report_CCDS25-0233.pdf).

## Demo

A 3-minute screen-recorded walkthrough (staff workflow → student attempt → AI grading loop) is embedded in slide 9 of the oral presentation deck:

- [`docs/fyp-presentation/CCDS25-0233_oral_presentation_with-video.pptx`](docs/fyp-presentation/CCDS25-0233_oral_presentation_with-video.pptx) — deck with embedded demo video
- [`docs/fyp-presentation/CCDS25-0233_oral_presentation.pdf`](docs/fyp-presentation/CCDS25-0233_oral_presentation.pdf) — slides only (PDF)
- [`fyp-report/Wang_Yu_Teng_FYP_Report_CCDS25-0233.pdf`](fyp-report/Wang_Yu_Teng_FYP_Report_CCDS25-0233.pdf) — submitted report

GitHub README markdown does not render embedded video from a repository path, so the deck is the canonical place to view the recorded demo.

## Features

### Student
- Browse enrolled courses and assignments with timing/late-policy info
- Take timed attempts with **auto-save every 30 s** and dual-layer expiry enforcement (client countdown + server cron force-submit)
- Three question types: **MCQ** (configurable wrong-answer penalty), **written**, **UML** (custom diagram editor)
- Opt-in **focus monitoring** — counts tab switches; threshold breach auto-submits
- Deterministic per-student question shuffling
- View graded submissions with per-criterion feedback

### Staff
- Course management + bulk CSV roster enrollment (transactional rollback on any invalid email)
- **Course-scoped question pool** with tag filtering and CSV/JSON import/export
- Assignment builder: due date, time limit, max attempts, late penalty (none / fixed / per-day / per-hour with cap), shuffling, focus-monitor threshold
- **Two-panel grading interface** with inline rubric scoring
- AI grading: trigger per-submission or batch; review suggestions with accept / reject / override; every published grade carries audit metadata (`source = ai_assisted`, original suggestion preserved, override reason for changes)
- Assignment analytics: grade distribution, question-level statistics
- Notifications for grading job completion / failure / auto-submitted attempts
- AI cost & token-usage tracking, aggregated daily

### Admin
- User management — create, bulk CSV create, deactivate, password reset
- LLM provider configuration (OpenAI / Anthropic, model selection per institution)
- System-wide settings

### Platform
- **Dual auth**: password-based custom JWT with refresh-token rotation **+** Supabase magic links
- **RBAC**: global roles (admin / staff / student) and course-scoped roles (lecturer / TA / lab_exec / student) enforced both server-side (middleware + Postgres RLS) and client-side (TanStack Router guards)
- Hardened HTTP layer: secure headers + CSP, strict CORS, body-size limits, IP rate limits (5/min on auth, 1000 / 15 min on the rest)
- Asynchronous LLM grading on a Postgres-backed job queue (Graphile Worker)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  React 19 SPA (Vite + TanStack Router/Query)        │
│  • Custom UML editor (React Flow + xyflow)          │
│  • Auto-save, focus monitor, dual-layer timer       │
└──────────────────────┬──────────────────────────────┘
                       │  Bearer JWT  /api/*
┌──────────────────────▼──────────────────────────────┐
│  Hono REST API (Node 20)                            │
│  • 11 route modules · ~134 endpoints                │
│  • authMiddleware → rlsMiddleware → handler         │
│  • Enqueues grading jobs                            │
└──────────────────────┬──────────────────────────────┘
                       │  pgboss-style queue (Graphile Worker)
┌──────────────────────▼──────────────────────────────┐
│  Worker process (concurrency = 1)                   │
│  • auto-grade-written / auto-grade-uml              │
│  • auto-submit-expired (cron, 60 s)                 │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  PostgreSQL (Supabase)  ·  16 tables · RLS enabled  │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
        OpenAI · Anthropic  (Vercel AI SDK)
```

**Why monolith + dedicated worker.** LLM grading takes 5–60 s per call; running it inside the request cycle would block the event loop under exam-period load. Decoupling enqueue (web) from execution (worker) keeps the request path responsive while the worker drains the queue serially. Single Docker image, two CMD overrides — `node dist/server/index.js` for the web tier, `node dist/server/worker.js` for the worker.

**Why dual-modality prompting.** UML is both structural and visual. The custom editor serialises its state to PlantUML DSL **and** to a rendered PNG; both go into the prompt, and the LLM cross-references them. This catches errors that either modality alone would miss (text-only loses notation/layout; vision-only hallucinates fine-grained labels). Output is enforced via Vercel AI SDK `generateObject()` + Zod schema with score clamping — Claude Opus and Sonnet hit a 100% parse rate in the experiment.

## Tech Stack

| Layer | Technology |
|---|---|
| Language / Runtime | TypeScript 5.9 (strict) · Node.js 20 |
| Frontend | React 19 · Vite 7 · TanStack Router (file-based) · TanStack Query · Tailwind CSS 4 · Headless UI · React Flow (xyflow 12) |
| Backend | Hono 4.11 · Drizzle ORM 0.45 · Zod 4.3 · Graphile Worker 0.16 |
| Auth | Supabase Auth + custom JWT via `jose` (dual-validation middleware) |
| Database | PostgreSQL via Supabase (pooled, transaction mode, port 6543) |
| LLM | Vercel AI SDK 6 → OpenAI (`@ai-sdk/openai`) · Anthropic (`@ai-sdk/anthropic`) |
| UML | `plantuml-encoder` + custom React Flow node/edge types |
| Testing | Vitest · Testing Library · Playwright |
| DevOps | Docker (multi-stage Node 20 Alpine) · Railway (primary) · Kubernetes manifests in [`k8s/`](k8s/) (on-prem reference) · GitHub Actions → ghcr.io |

## Quick Start

```bash
git clone https://github.com/WangYuTengg/fyp.git && cd fyp
npm install
cp .env.example .env        # fill in DATABASE_URL, Supabase keys, JWT_SECRET, OPENAI/ANTHROPIC keys
npm run db:migrate          # apply schema
npm run db:seed             # 2 courses, 50 students, 1 assignment
npm run dev                 # client :5173 · server :3000 · worker (Graphile)
```

`npm run dev` starts client, server, and worker concurrently. Client and server hot-reload independently.

### Common Commands

```bash
# Development
npm run dev                  # client + server + worker
npm run dev:client           # Vite only
npm run dev:server           # Hono with tsx watch
npm run dev:worker           # Graphile Worker

# Database (Drizzle)
npm run db:generate          # generate migration from schema diff
npm run db:migrate           # apply pending migrations
npm run db:push              # dev-only: push schema directly (skips migrations)
npm run db:studio            # Drizzle Studio GUI
npm run db:seed              # seed users + courses + questions + assignments
npm run db:reset / db:wipe   # full reset / wipe (destructive)

# Testing
npm test                     # Vitest
npm run test:watch
npm run test:coverage
npm run test:stress          # stress tests under src/test/stress
npm run test:e2e             # Playwright

# Build / Run
npm run build                # build client + server (tsc + Vite)
npm start                    # NODE_ENV=production node dist/server/index.js

# Lint
npm run lint
```

## Repository Structure

```
src/
├── client/                          # React SPA
│   ├── routes/                      # TanStack Router (file-based)
│   │   ├── __root.tsx               # Root layout + Sidebar
│   │   ├── login.tsx, forgot-password.tsx, reset-password.tsx
│   │   ├── student/                 # Student views
│   │   └── staff/                   # Staff + admin views
│   ├── features/                    # Feature modules (hooks + components + types)
│   │   ├── student-dashboard, student-course, student-assignment, student-submission
│   │   ├── staff-dashboard, staff-course, staff-grading
│   │   ├── staff-settings, staff-notifications
│   │   └── admin-users
│   ├── components/
│   │   ├── UMLEditor.tsx, UMLViewer.tsx
│   │   ├── uml/                     # ClassDiagramEditor, SequenceDiagramEditor, plantUmlParser
│   │   ├── Sidebar.tsx, Modal.tsx, ErrorBoundary.tsx, UserInfo.tsx
│   ├── contexts/AuthContext.tsx
│   └── lib/api.ts                   # apiClient with Bearer-token injection
│
├── server/
│   ├── index.ts                     # Hono app: secure headers, CORS, rate limits, RLS, routes
│   ├── worker.ts                    # Graphile Worker entrypoint
│   ├── routes/                      # 11 modules
│   │   ├── auth/                    # signin, signup, password-login, magic-link, refresh, reset-password
│   │   ├── courses/                 # CRUD, enroll, bulk-enroll, export-grades, automation-settings
│   │   ├── assignments/             # CRUD, publish, analytics, clone
│   │   ├── submissions/             # start, save, submit, focus events, grade
│   │   ├── questions/               # CRUD + CSV/JSON import-export
│   │   ├── tags/                    # tag CRUD
│   │   ├── auto-grade/              # batch, single, queue, accept, reject, batch-accept, review-queue, stats
│   │   ├── admin/                   # user CRUD, bulk-create, password reset
│   │   ├── notifications/           # list, mark-read, unread-count
│   │   ├── settings/                # LLM provider config
│   │   └── users/                   # user metadata
│   ├── jobs/                        # Graphile Worker tasks
│   │   ├── auto-grade-written.ts    # LLM grading for essays
│   │   ├── auto-grade-uml.ts        # Dual-modality (text + image) UML grading
│   │   └── auto-submit-expired.ts   # 60-second cron for expired drafts
│   ├── middleware/
│   │   ├── auth.ts                  # JWT validation (custom + Supabase)
│   │   └── rls.ts                   # Postgres RLS-scoped transaction
│   ├── lib/
│   │   ├── ai.ts                    # OpenAI / Anthropic provider factory
│   │   ├── notifications.ts, email.ts (SMTP)
│   │   ├── grading-utils.ts, mcq-grading.ts, content-utils.ts
│   │   ├── analytics-utils.ts, validators.ts, validation-schemas.ts
│   │   └── worker.ts                # Graphile Worker config
│   └── config/
│       ├── env.ts                   # fail-fast env validation
│       ├── prompts.ts               # LLM prompt templates
│       ├── pricing.ts               # token cost per model
│       └── constants.ts             # rate limits, AI config
│
├── db/
│   ├── schema.ts                    # 16 tables, 6 enums (Drizzle ORM)
│   ├── migrations/                  # auto-generated SQL
│   ├── migrate.ts                   # production migration runner (used by Railway preDeploy)
│   ├── seed.ts, seed-submissions.ts, reset.ts, wipe.ts
│   └── index.ts                     # postgres-js connection
│
└── lib/                             # shared types between client/server
    ├── supabase.ts
    └── assessment.ts

experiment/                          # standalone Python harness for the LLM benchmark
├── run.py                           # generate / benchmark / analyze / all
├── config.yaml, prompts/, src/, data/
└── requirements.txt

docs/
├── agents/                          # detailed convention docs (architecture, api-design, auth, db, frontend, style, ts-conventions)
├── fyp-presentation/                # oral defense deck (.pptx, .pdf, embedded video)
├── fyp-report-draft/                # chapter markdown
├── DEPLOYMENT.md
├── example-uml-questions.md
└── question-pool-ux-decisions.md

k8s/                                 # on-prem reference manifests (HPA web tier, single-replica worker)
e2e/                                 # Playwright specs
fyp-report/                          # final submitted report PDF
.github/workflows/build-deploy.yml   # lint + Vitest + Docker build → ghcr.io
```

## Database

16 tables in 5 functional groups (full schema in [`src/db/schema.ts`](src/db/schema.ts)):

| Group | Tables |
|---|---|
| Identity | `users`, `password_reset_tokens`, `refresh_tokens` |
| Courses | `courses`, `enrollments` |
| Content | `questions`, `assignments`, `assignment_questions`, `rubrics` |
| Attempts | `submissions`, `answers`, `marks` |
| AI / Ops | `ai_grading_jobs`, `ai_usage_stats`, `staff_notifications`, `system_settings` |

Design choices worth flagging:

- **JSONB for polymorphic question content** — three question shapes (MCQ / written / UML) without separate content tables.
- **PostgreSQL enums for state machines** — `submission_status: draft → submitted → late → grading → graded` enforced at the DB level, not in app code.
- **Composite uniqueness constraints** — prevent retry-storm duplicates (enrollments, answers) under concurrent exam load.
- **Row-Level Security** — `rlsMiddleware` wraps each authenticated request in an RLS-scoped Postgres transaction; route handlers use `c.get('rlsDb')` for protected queries.
- **Audit trail** — `marks` table is gated behind explicit staff accept/reject; `aiGradingJobs` retains the raw LLM suggestion alongside provider, model, token usage, and cost.

## Environment

See [`.env.example`](.env.example) for the full list. Required variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (use Supabase pooled / port 6543 in production) |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_APP_URL` | Frontend URL (default `http://localhost:5173`) |
| `JWT_SECRET` | Custom JWT signing key — **must be ≥ 32 chars** (generate with `openssl rand -hex 32`) |
| `PORT` | Server port (default `3000`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Email config (password reset, magic links) |
| `OPENAI_API_KEY` | OpenAI key for LLM grading |
| `ANTHROPIC_API_KEY` | Anthropic key for LLM grading |

Env vars are validated fail-fast at startup in [`src/server/config/env.ts`](src/server/config/env.ts).

## Deployment

### Railway (primary)

Two services build from the same Dockerfile, both deployed to `asia-southeast1` (Singapore):

- **`web`** — Hono API + SPA static files. Config: [`railway.toml`](railway.toml). Healthcheck: `/api/health/ready`. `preDeployCommand` runs `node dist/db/migrate.js` so the schema is current before traffic hits.
- **`worker`** — Graphile Worker. No HTTP server, no public domain. Start command: `node dist/server/worker.js`. Config: [`railway.worker.toml`](railway.worker.toml).

Auto-deploys on push to `main`. Set the same environment variables on both services (the Railway CLI is per-service); web-only vars are `PORT`, `VITE_APP_URL`, `VITE_API_URL`, and `SMTP_*`.

**Production migration command must be `node dist/db/migrate.js`**, not `npm run db:migrate` — the npm script uses `tsx`, which is a dev dependency and isn't installed in the production image.

### Kubernetes (on-prem reference)

Manifests in [`k8s/`](k8s/) — HPA-scaled web tier (2→6 replicas), single-replica worker, pre-deploy migration job, ConfigMap + Secret split. Same Docker image as Railway, published to `ghcr.io/wangyutengg/fyp` by [`.github/workflows/build-deploy.yml`](.github/workflows/build-deploy.yml). Intended for schools self-hosting on their own cluster (k3s or full k8s); not actively deployed.

### Docker (local)

```bash
docker-compose up --build

# or manually with build args (Vite vars are baked at build time)
docker build -t fyp \
  --build-arg VITE_SUPABASE_URL=... \
  --build-arg VITE_SUPABASE_ANON_KEY=... .
docker run -p 3000:3000 --env-file .env fyp
```

The image runs as a non-root `appuser`. Override `CMD` to `["node", "dist/server/worker.js"]` to start the worker role from the same image.

## CI/CD

[`.github/workflows/build-deploy.yml`](.github/workflows/build-deploy.yml):

1. **Test** — ESLint + Vitest on every push and PR.
2. **Build** — Multi-stage Docker image pushed to `ghcr.io` (main only).
3. **Deploy** — Migrations applied as a pre-deploy job before pods serve traffic.

## LLM Benchmark Experiment

The empirical contribution lives in [`experiment/`](experiment/) — a standalone Python harness that evaluates 6 frontier models against single-grader UML class-diagram ground truth.

**Setup:** 2 real submissions (McGill UML repository, Umple → PlantUML converted) + 30 synthetic submissions across 5 quality tiers and 3 domains (Library / E-Commerce / Hospital). 5-criterion rubric (class correctness · relationship accuracy · cardinality · naming · completeness). 5 runs per submission per model at temperature 0.0. **Total: 960 API calls.**

**Weighted aggregate** (accuracy 35% · consistency 25% · feedback 15% · cost 10% · rubric adherence 10% · speed 5%):

| Rank | Model | Score | Pearson r | MAE / 10 | $/sub | Recommendation |
|---|---|---|---|---|---|---|
| 1 | **Claude Opus 4.6** | 0.87 | **0.92** | **0.68** | 0.032 | Production default |
| 2 | Claude Sonnet 4.6 | 0.87 | 0.89 | 0.78 | 0.018 | Cost-effective alternative |
| 3 | GPT-5.4 | 0.84 | 0.86 | 0.90 | 0.020 | Fallback |
| 4 | Gemini 3.1 Pro | 0.83 | 0.85 | 0.95 | 0.015 | — |
| 5 | GPT-5.4 Mini | 0.80 | 0.79 | 1.25 | 0.005 | — |
| 6 | Gemini 3 Flash | 0.77 | 0.74 | 1.48 | 0.003 | — |

Both Claude models hit **100% structured-output parse rate**, addressing the format-compliance issue that Piscitelli et al. (2025) flagged for earlier-generation evaluations. All models showed negative mean bias (over-strictness vs. the human grader), consistent with prior literature.

Run end-to-end with:

```bash
cd experiment
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python run.py all
```

## Project Context

**FYP scope (CCDS25-0233).** Five objectives: (O1) full-stack assessment platform, (O2) LLM grading pipeline with structured-output enforcement, (O3) reduce TA grading effort via two-panel review UI, (O4) empirical evaluation of SOTA LLMs, (O5) containerised on-prem deployment. O1, O2, O4 are fully met; O3 designed for time-saving but pending a formal user study; O5 architecturally complete but pending realistic-load test.

**Threats to validity.** The dataset is small and predominantly synthetic (30/32 submissions). Ground truth is single-grader. Only class diagrams are evaluated empirically (the editor and grading pipeline support sequence diagrams, but those weren't in the experiment). Detailed discussion in §4.4 of the report.

**Future work** prioritises (a) real-student multi-grader benchmarks to recalibrate the −0.28 → −1.02 LLM bias estimates, (b) extending evaluation to sequence/activity/state/ER diagrams, (c) air-gapped deployment via Ollama / vLLM for schools that cannot permit outbound LLM traffic.

## License

MIT
