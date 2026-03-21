# Development Practices

## Development Workflow

### Running Locally
```bash
npm run dev              # Starts both client (:5173) and server (:3000) via concurrently
npm run dev:client       # Vite dev server only
npm run dev:server       # Hono with tsx watch + .env loaded
```

- Vite proxies `/api` requests to `http://localhost:3888` (see `vite.config.ts`)
- Server uses `tsx watch` for hot reload during development

### Database Workflow
```bash
npm run db:generate      # Generate migration SQL from schema changes
npm run db:migrate       # Apply migrations via tsx src/db/migrate.ts
npm run db:push          # Push schema directly (dev shortcut)
npm run db:studio        # Drizzle Studio GUI
npm run db:seed          # Seed test data
npm run db:seed-passwords # Seed test user passwords
npm run db:reset         # Reset database
```

Schema-first approach: modify `src/db/schema.ts` → generate → migrate.

## Build

```bash
npm run build            # tsc -b && vite build && tsc --project tsconfig.server.json
npm run build:client     # Client only (tsc -b && vite build)
npm run build:server     # Server only (tsc --project tsconfig.server.json)
npm start                # NODE_ENV=production node dist/server/index.js
```

- Client builds to `dist/client/` with manual chunks (tanstack, supabase, uml, ui)
- Server builds to `dist/server/`
- Production server serves static client assets + API

## Testing

### Unit/Integration Tests
```bash
npm test                 # vitest run
npm run test:watch       # vitest (watch mode)
npm run test:coverage    # vitest run --coverage (v8 provider)
npm run test:stress      # vitest run src/test/stress/
```

- **Vitest** as test runner with jsdom environment
- **Testing Library** (`@testing-library/react`, `@testing-library/jest-dom`) for component tests
- Test files colocated with source: `*.test.ts` next to the module they test
- ~33 test files across server utilities, route handlers, and client components

### E2E Tests
```bash
npm run test:e2e         # playwright test
```
- **Playwright** for end-to-end browser testing

## Linting

```bash
npm run lint             # eslint . (no auto-fix)
```

- ESLint 9 flat config
- TypeScript-ESLint recommended rules
- React Hooks + React Refresh plugins
- No Prettier — consistent formatting via editor settings

## Git Conventions

### Commit Messages
Format: `type(scope): description`

Types observed in history:
- `feat` — new features (`feat(grading): inline rubric scoring`)
- `fix` — bug fixes (`fix(db): type seed query result`)
- `refactor`, `chore`, `docs`, `test`

### Branch Strategy
- Push to `main` directly (no PR workflow for solo development)
- PRs used occasionally for larger features (merged via GitHub)

## CI/CD Pipeline

**GitHub Actions** (`.github/workflows/build-deploy.yml`):

```
push to main / PR → test → build → deploy
```

### Jobs
1. **test** — `npm ci` → `npm run lint` → `vitest run --reporter=github-actions`
2. **build** — Docker image → push to `ghcr.io` (skipped on PRs)
3. **deploy** — Run `npm run db:migrate` against production DB (main branch only)

### Docker
- Multi-stage build: builder (full deps + build) → production (prod deps + dist)
- Node.js 20 Alpine base
- Non-root user (`appuser`) in production
- Health check: `GET /api/health/ready`
- Single image, CMD overridable for worker process

```bash
docker-compose up --build    # Local Docker run
```

## Environment Configuration

Key env vars (see `.env.example`):
- `DATABASE_URL` — PostgreSQL connection string
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase auth
- `VITE_APP_URL` — Frontend URL (default `http://localhost:5173`)
- `PORT` — Server port (default 3000)
- `JWT_SECRET` — Custom JWT signing key (min 32 chars)
- `SMTP_*` — Email configuration for password reset
- `OPENAI_API_KEY` / Anthropic key — LLM grading

Vite env vars (`VITE_*`) are embedded at build time and must be provided as Docker build args.

Server validates env at startup via `src/server/config/env.ts` — fails fast on missing required vars.

## TypeScript Configuration

4 tsconfig files:
- `tsconfig.json` — base config with project references
- `tsconfig.app.json` — client code (React JSX, DOM libs)
- `tsconfig.node.json` — Vite config files
- `tsconfig.server.json` — server code (Node types, ES2022 target)
