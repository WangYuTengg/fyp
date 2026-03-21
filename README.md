# UML Assessment Platform

Automated assessment platform for educational institutions -- supports MCQ, written, coding, and UML diagram assignments with LLM-assisted grading. Designed for on-premise school deployment.

## Features

### Student Experience
- Browse enrolled courses and assignments
- Take timed assessments with auto-save and auto-submit
- MCQ with configurable penalty scoring, written responses, UML diagram editor
- Focus monitoring with tab-switch tracking
- Deterministic question shuffling per student
- View grades and download submission receipts

### Staff Experience
- Course management with bulk enrollment (CSV upload)
- Question pool with tagging, filtering, import/export (CSV/JSON)
- Assignment builder with question reuse across courses
- Rubric editor with multi-level scoring criteria
- Manual grading interface with inline rubric scoring
- AI-assisted grading with accept/reject/override workflow
- Batch auto-grading with queue monitoring
- Assignment analytics: grade distribution, question-level stats
- AI cost tracking and usage analytics

### Admin
- User management (create, bulk create via CSV, deactivate, reset passwords)
- LLM provider configuration (OpenAI/Anthropic, model selection)
- System-wide settings

### Platform
- Dual auth: password-based JWT with refresh token rotation + Supabase magic links
- Role-based access: global roles (admin, staff, student) + course-scoped roles (lecturer, TA, lab_exec)
- Rate limiting, security headers, CORS, body size limits
- Background job processing via Graphile Worker

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, TypeScript, TanStack Router + Query, Tailwind CSS 4, Headless UI |
| Backend | Hono, Node.js 20 |
| Database | PostgreSQL (Neon) + Drizzle ORM |
| Auth | Supabase + custom JWT (jose) |
| Background Jobs | Graphile Worker |
| LLM | Vercel AI SDK 6 -- OpenAI (GPT-4o) / Anthropic (Claude 3.5 Sonnet) |
| Testing | Vitest, Testing Library, Playwright |
| DevOps | Docker, GitHub Actions -- ghcr.io |

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL database (or Neon account)
- Supabase project (for magic link auth)

### Setup

```bash
git clone <repo-url> && cd fyp
npm install
cp .env.example .env   # Fill in values
npm run db:migrate      # Apply database migrations
npm run dev             # Starts client (:5173) + server (:3000)
```

### Key Commands

```bash
# Development
npm run dev              # Both client + server
npm run dev:client       # Vite dev server only
npm run dev:server       # Hono with tsx watch

# Database
npm run db:generate      # Generate migration from schema changes
npm run db:migrate       # Apply migrations
npm run db:studio        # Drizzle Studio GUI
npm run db:seed          # Seed test data

# Testing
npm test                 # Vitest (run once)
npm run test:watch       # Vitest (watch mode)
npm run test:e2e         # Playwright E2E tests

# Build & Deploy
npm run build            # Build client + server
npm start                # Start production server
docker-compose up --build # Docker
```

## Project Structure

```
src/
├── client/                          # React SPA
│   ├── routes/                      # TanStack Router file-based routing
│   │   ├── __root.tsx               # Root layout with Sidebar
│   │   ├── login.tsx, forgot-password.tsx, reset-password.tsx
│   │   ├── student/                 # Student views
│   │   └── staff/                   # Staff views (courses, grading, analytics, settings, admin)
│   ├── features/                    # Feature modules
│   │   ├── staff-dashboard/         # Course grid, create course
│   │   ├── staff-course/            # Course detail, question pool, assignment builder
│   │   ├── staff-grading/           # Grading dashboard, AI review, analytics
│   │   ├── staff-settings/          # LLM provider configuration
│   │   ├── staff-notifications/     # Grading job notifications
│   │   ├── admin-users/             # User management
│   │   ├── student-dashboard/       # Student course grid
│   │   ├── student-course/          # Course detail, assignment list
│   │   ├── student-assignment/      # Assignment attempt, timer, focus monitor
│   │   └── student-submission/      # Submission review
│   ├── components/                  # Shared: Modal, Sidebar, UMLEditor, ErrorBoundary
│   ├── contexts/AuthContext.tsx     # Auth state + DB user roles
│   └── lib/api.ts                   # API client with Bearer token injection
│
├── server/
│   ├── routes/                      # Hono route handlers (11 modules)
│   │   ├── auth/                    # Signin, signup, magic link, password reset, refresh
│   │   ├── courses/                 # CRUD, enrollments, bulk enroll
│   │   ├── assignments/             # CRUD, publish, analytics, clone
│   │   ├── submissions/             # Start, save, submit, grade, focus events
│   │   ├── questions/               # CRUD, import/export CSV/JSON
│   │   ├── auto-grade/              # Queue, batch, accept/reject, stats
│   │   ├── admin/                   # User CRUD, bulk create, password reset
│   │   ├── notifications/           # List, mark read, unread count
│   │   └── settings/                # LLM provider config
│   ├── jobs/                        # Graphile Worker tasks
│   │   ├── auto-grade-written.ts    # LLM grading for essays
│   │   └── auto-grade-uml.ts       # Vision API for UML diagrams
│   ├── middleware/
│   │   ├── auth.ts                  # JWT validation + role extraction
│   │   └── rls.ts                   # PostgreSQL row-level security
│   ├── lib/
│   │   ├── ai.ts                    # LLM provider factory (OpenAI/Anthropic)
│   │   ├── notifications.ts         # Staff notification helpers
│   │   ├── email.ts                 # SMTP email sending
│   │   ├── grading-utils.ts         # Grade calculation utilities
│   │   └── analytics-utils.ts       # Analytics aggregation
│   └── config/
│       ├── prompts.ts               # LLM prompt templates
│       ├── pricing.ts               # Token cost per provider/model
│       ├── constants.ts             # Rate limits, AI config
│       └── env.ts                   # Environment validation
│
├── db/
│   ├── schema.ts                    # 13 tables (Drizzle ORM)
│   ├── migrations/                  # Auto-generated SQL
│   ├── migrate.ts                   # Migration runner
│   ├── seed.ts                      # Test data seeder
│   └── index.ts                     # Database connection
│
└── lib/
    ├── supabase.ts                  # Supabase client
    └── assessment.ts                # Shared assessment types
```

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Description |
|----------|------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_APP_URL` | Frontend URL (default `http://localhost:5173`) |
| `JWT_SECRET` | Custom JWT signing key (min 32 chars) |
| `PORT` | Server port (default 3000) |
| `SMTP_*` | Email config for password reset |
| `OPENAI_API_KEY` | OpenAI API key for LLM grading |

## Docker

```bash
# Build and run
docker-compose up --build

# Or manually
docker build -t fyp \
  --build-arg VITE_SUPABASE_URL=... \
  --build-arg VITE_SUPABASE_ANON_KEY=... .
docker run -p 3000:3000 --env-file .env fyp
```

The Docker image runs as a non-root user. Override CMD to `["node", "dist/server/worker.js"]` for the background worker process.

## CI/CD

GitHub Actions workflow (`.github/workflows/build-deploy.yml`):
1. **Test** -- lint + Vitest on every push/PR
2. **Build** -- Docker image pushed to `ghcr.io` (main branch only)
3. **Deploy** -- Database migrations run against production

## License

MIT
