# Coding Standards

## Language & Runtime

- **TypeScript** in strict mode across client and server
- **Node.js 20** runtime (see Dockerfile, CI)
- **ES Modules** (`"type": "module"` in package.json, `.js` extensions in server imports)

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files (non-component) | `kebab-case.ts` | `analytics-utils.ts`, `auth-context.ts` |
| React components | `PascalCase.tsx` | `CourseGrid.tsx`, `QuestionCard.tsx` |
| Functions & variables | `camelCase` | `fetchDbUser`, `settingsCache` |
| Constants | `UPPER_SNAKE_CASE` | `RATE_LIMIT_CONFIG`, `CACHE_TTL` |
| Types | `PascalCase` with `type` keyword (not `interface`) | `type AuthContext = { ... }` |
| Enums (DB) | `snake_case` strings | `'user_role'`, `'submission_status'` |
| Database columns | `camelCase` in Drizzle, `snake_case` in SQL | `createdAt` → `created_at` |

## Code Style

- **`const` over `let`**, no `var`
- **`type` over `interface`** — used consistently across the codebase
- **No `any`** — use `unknown` + narrowing; leverage Drizzle's `$inferSelect` / `$inferInsert`
- **Functional patterns** — array methods over imperative loops, immutable data
- **Arrow functions** for most declarations:
  ```ts
  const getModel = async () => { ... };
  export const userApi = { getCurrentUser: () => apiClient('/api/auth/me') };
  ```
- **Error handling**: try/catch with `unknown` error type, narrowed before use:
  ```ts
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
  }
  ```

## File Organization

- **Feature-based structure** on the client — each feature has its own `hooks/`, `components/`, `types.ts`:
  ```
  src/client/features/staff-course/
  ├── hooks/useStaffCourse.ts
  ├── components/CourseHeader.tsx
  ├── types.ts
  ├── utils/question-utils.ts
  └── README.md
  ```
- **Resource-based routes** on the server — one file per operation:
  ```
  src/server/routes/courses/
  ├── index.ts          # Route registration
  ├── list-courses.ts
  ├── get-course.ts
  ├── create-course.ts
  └── enroll.ts
  ```

## Import Patterns

- Server uses `.js` extensions for local imports (ESM requirement):
  ```ts
  import { db } from '../../db/index.js';
  ```
- Client uses bare specifiers (Vite resolves):
  ```ts
  import { supabase } from '../../lib/supabase';
  ```
- Path alias `@` mapped to `./src` in Vite config

## API Response Format

All endpoints return:
```ts
{ success: true, data: { ... } }
// or
{ success: false, error: "User-friendly message" }
```

Status codes: 200, 201, 400, 401, 403, 404, 500.

## Linting

- ESLint 9 flat config with `typescript-eslint`, `react-hooks`, `react-refresh`
- No Prettier configured — formatting relies on editor defaults
- `dist/` directory ignored

## Database Schema Conventions

- All tables have `createdAt` + `updatedAt` (update `updatedAt` manually in `.set()`)
- UUIDs as primary keys (`uuid('id').defaultRandom().primaryKey()`)
- JSONB for flexible content (MCQ options, rubrics, tab switch logs)
- Explicit indexes on foreign keys and query-hot columns
- Relations defined separately via `relations()` from `drizzle-orm`
