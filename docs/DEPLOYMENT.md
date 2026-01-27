# Deployment Guide

Complete guide for deploying the UML Assessment Platform to production.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ database
- Supabase project (for auth and storage)
- OpenAI or Anthropic API key (for auto-grading)

## Environment Variables

Create a `.env` file with the following variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database
# Example: postgresql://postgres:password@localhost:5432/fyp

# Supabase (Auth & Storage)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Application
VITE_APP_URL=https://your-domain.com
# For local dev: http://localhost:5173
PORT=3000
NODE_ENV=production

# LLM Provider
LLM_PROVIDER=openai
# Options: openai, anthropic
LLM_MODEL=gpt-4o
# OpenAI models: gpt-4o, gpt-4-turbo, gpt-3.5-turbo
# Anthropic models: claude-3-5-sonnet-20241022, claude-3-opus-20240229

# API Keys (choose based on LLM_PROVIDER)
OPENAI_API_KEY=sk-...
# Or
ANTHROPIC_API_KEY=sk-ant-...
```

### Environment Variable Descriptions

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key (safe for client) |
| `VITE_APP_URL` | Yes | Public URL of your app |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | Yes | Environment (`production`, `development`) |
| `LLM_PROVIDER` | No | AI provider (default: `openai`) |
| `LLM_MODEL` | No | AI model (default: `gpt-4o`) |
| `OPENAI_API_KEY` | Conditional | Required if `LLM_PROVIDER=openai` |
| `ANTHROPIC_API_KEY` | Conditional | Required if `LLM_PROVIDER=anthropic` |

## Supabase Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings → API
3. Enable Email authentication in Authentication → Providers

### 2. Create Storage Bucket

```sql
-- In Supabase SQL Editor
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false);

-- Set up RLS policies for submissions bucket
create policy "Users can upload their own files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'submissions' 
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users can read their own files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'submissions'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Staff can read all files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'submissions'
  and exists (
    select 1 from public.users
    where users.supabase_id = auth.uid()
    and users.role in ('staff', 'admin')
  )
);
```

See [docs/SUPABASE_STORAGE_SETUP.md](./SUPABASE_STORAGE_SETUP.md) for detailed instructions.

### 3. Create Users

Users are created automatically on first login via Supabase Auth. The app syncs user data to the `users` table on first authenticated request.

To set a user as staff/admin:

```sql
update users set role = 'staff' where email = 'instructor@example.com';
update users set role = 'admin' where email = 'admin@example.com';
```

## Database Setup

### 1. Run Migrations

```bash
npm run db:migrate
```

This applies all migrations in `src/db/migrations/` to your database.

### 2. Verify Schema

```bash
npm run db:studio
```

Opens Drizzle Studio on `https://local.drizzle.studio` to inspect your database.

## Build & Deploy

### Option 1: Docker (Recommended)

1. **Build the image:**

```bash
docker build -t uml-assessment-platform .
```

2. **Run the container:**

```bash
docker run -d \
  --name uml-platform \
  -p 3000:3000 \
  --env-file .env \
  uml-assessment-platform
```

3. **Using Docker Compose:**

```bash
docker-compose up -d
```

The `docker-compose.yml` includes both the app and a PostgreSQL database.

### Option 2: Node.js Server

1. **Install dependencies:**

```bash
npm install
```

2. **Build the application:**

```bash
npm run build
```

This creates:
- `dist/client/` - Frontend static files
- `dist/server/` - Backend JavaScript

3. **Run migrations:**

```bash
npm run db:migrate
```

4. **Start the server:**

```bash
npm start
```

The server will:
- Serve the frontend on `http://localhost:3000`
- Expose API on `http://localhost:3000/api`
- Initialize the Graphile Worker for auto-grading jobs

### Option 3: Vercel (Frontend + Serverless Functions)

**Note:** Graphile Worker requires a long-running process, so auto-grading won't work on Vercel. Use Docker or Node.js deployment for full functionality.

```bash
npm install -g vercel
vercel --prod
```

Set environment variables in Vercel dashboard.

## Post-Deployment Checklist

- [ ] Database migrations applied
- [ ] Supabase storage bucket created with RLS policies
- [ ] Environment variables configured
- [ ] First admin user created and role updated
- [ ] Test login with Supabase credentials
- [ ] Test file upload (UML question)
- [ ] Verify auto-grading worker is running (check logs)
- [ ] Test auto-grading batch job
- [ ] Check AI usage stats endpoint
- [ ] Set up monitoring/logging (optional)

## Monitoring

### Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{"status":"ok"}
```

### Check Worker Status

View server logs for:
```
✓ Graphile Worker initialized
```

If worker fails to initialize, the server will exit with an error.

### Monitor AI Usage

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/auto-grade/stats?period=week
```

## Troubleshooting

### Worker Fails to Start

**Error:** `FATAL: Failed to initialize Graphile Worker`

**Solutions:**
1. Check `DATABASE_URL` is correct
2. Ensure PostgreSQL is running and accessible
3. Verify database user has necessary permissions
4. Check if another process is using the worker tables

### File Uploads Fail

**Error:** `Failed to upload file: The resource already exists`

**Solutions:**
1. Set `upsert: false` in upload call (already done)
2. Check Supabase Storage RLS policies
3. Verify `VITE_SUPABASE_ANON_KEY` is set correctly

### Auto-Grading Jobs Stuck in Pending

**Solutions:**
1. Check worker is running: `ps aux | grep node`
2. View Graphile Worker jobs: `SELECT * FROM graphile_worker.jobs;`
3. Check server logs for errors
4. Verify API key is set (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`)

### Rate Limiting Issues

If you're hitting rate limits during testing:

1. Adjust `RATE_LIMIT_CONFIG` in `src/server/config/constants.ts`
2. Rebuild and restart server
3. For testing, you can temporarily increase limits

## Security Considerations

### Production Checklist

- [ ] Use HTTPS (TLS/SSL certificate)
- [ ] Set `NODE_ENV=production`
- [ ] Rotate API keys regularly
- [ ] Enable Supabase RLS policies
- [ ] Use strong database password
- [ ] Set up CORS properly for your domain
- [ ] Review rate limiting settings
- [ ] Enable database backups
- [ ] Monitor API usage and costs
- [ ] Set up error tracking (Sentry, etc.)

### CORS Configuration

Add CORS middleware in `src/server/index.ts` if deploying to a different domain:

```typescript
import { cors } from 'hono/cors';

app.use('/*', cors({
  origin: ['https://your-domain.com'],
  credentials: true,
}));
```

## Scaling Considerations

### Database

- Add read replicas for heavy read loads
- Set up connection pooling (PgBouncer)
- Monitor slow queries and add indexes as needed

### Worker Concurrency

To process auto-grading jobs faster, increase concurrency in `src/server/config/constants.ts`:

```typescript
export const WORKER_CONFIG = {
  CONCURRENCY: 5, // Process 5 jobs in parallel
  // ...
};
```

**Warning:** Higher concurrency = higher AI API costs

### Caching

Consider adding Redis for:
- API response caching
- Session storage
- Rate limiting (currently in-memory)

## Backup & Recovery

### Database Backups

```bash
# Backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup_20240115.sql
```

### Supabase Storage Backups

Use Supabase dashboard or API to download all files in the `submissions` bucket.

## Cost Estimation

### AI API Costs

Based on `gpt-4o` pricing (~$5/1M input tokens, ~$15/1M output tokens):

- Average grading: 1000 tokens (~500 input, ~500 output)
- Cost per grading: ~$0.01
- 100 auto-gradings: ~$1.00

Monitor actual costs via `/api/auto-grade/stats` endpoint.

### Supabase Costs

- Free tier: 500MB database, 1GB storage, 2GB bandwidth
- Pro: $25/month for 8GB database, 100GB storage

See [supabase.com/pricing](https://supabase.com/pricing)

## Additional Resources

- [API Documentation](./API.md)
- [Architecture Guide](./agents/architecture.md)
- [Database Schema](./agents/database.md)
- [Supabase Storage Setup](./SUPABASE_STORAGE_SETUP.md)
