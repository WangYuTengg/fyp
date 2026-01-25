# UML Assessment Platform - Agent Instructions

An automated assessment platform for UML diagrams with LLM-assisted grading, designed for on-premise school deployment.

## Quick Reference

**Package Manager**: `npm`

**Dev Commands**:
```bash
npm run dev          # Start both client + server
npm run dev:client   # Vite dev server (port 5173)
npm run dev:server   # Hono API server (port 3000)
```

**Build Commands**:
```bash
npm run build        # Build both client + server
npm run build:client # Build client only
npm run build:server # Build server only
```

**Database Commands**:
```bash
npm run db:generate  # Generate migrations from schema
npm run db:migrate   # Apply migrations
npm run db:studio    # Open Drizzle Studio
```

## Tech Stack

- **Frontend**: Vite + React + TypeScript + TanStack Router + Tailwind CSS
- **Backend**: Hono + Supabase Auth + PostgreSQL + Drizzle ORM
- **DevOps**: Docker + GitHub Actions

## Detailed Instructions

For specific implementation guidance, refer to:

- **[Architecture & Project Structure](docs/agents/architecture.md)** - Folder organization, client/server separation, routing patterns
- **[TypeScript Conventions](docs/agents/typescript-conventions.md)** - Type safety, interfaces, error handling
- **[Database & ORM](docs/agents/database.md)** - Drizzle schema, migrations, queries, relationships
- **[API Design](docs/agents/api-design.md)** - Hono routes, middleware, error responses
- **[Authentication](docs/agents/auth.md)** - Supabase auth flow, middleware, session handling
- **[Frontend Patterns](docs/agents/frontend.md)** - React components, routing, state management, Tailwind

## Environment Variables

Required in `.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/fyp
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_APP_URL=http://localhost:5173
PORT=3000
```
