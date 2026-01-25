# Project Setup Instructions

## Status
- [x] Create copilot-instructions.md file
- [x] Scaffold Vite + React + TypeScript project
- [x] Configure project structure (client/server separation)
- [x] Install and configure all dependencies
- [x] Set up Tailwind CSS
- [x] Configure Drizzle ORM
- [x] Set up Hono server with Supabase auth
- [x] Configure Docker
- [x] Set up GitHub Actions
- [x] Install dependencies and verify build

## Tech Stack
- Vite
- React
- TypeScript
- TanStack Router
- Tailwind CSS
- Hono (server)
- Supabase (auth + JS client)
- Drizzle ORM
- Docker
- GitHub Actions

## Next Steps
1. Update `.env` file with your Supabase credentials
2. Configure your PostgreSQL database URL
3. Run `npm run db:generate` to create initial migrations
4. Run `npm run dev` and `npm run dev:server` in separate terminals for development
5. Customize the schema in `src/db/schema.ts` as needed
