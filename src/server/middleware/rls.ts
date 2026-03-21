import type { Context, Next } from 'hono';
import { sql } from 'drizzle-orm';
import { db, type Database } from '../../db/index.js';
import type { AuthContext } from './auth.js';

/**
 * Middleware that wraps authenticated requests in an RLS-scoped transaction.
 * Sets Supabase's request.jwt.claims so auth.uid() and auth.jwt() work in
 * RLS policies, then switches to the `authenticated` role.
 *
 * Must run AFTER authMiddleware. Route handlers use c.get('rlsDb') for
 * RLS-protected queries, or the db import for owner-level access.
 *
 * Note: The transaction is held open for the duration of the request.
 * For long-running handlers (e.g., LLM grading), use withRLS() from
 * src/db/rls.ts instead to scope the transaction more tightly.
 */
export async function rlsMiddleware(c: Context<AuthContext>, next: Next) {
  const user = c.get('user');

  if (!user) {
    c.set('rlsDb', null);
    return next();
  }

  const claims = JSON.stringify({ sub: user.id, user_role: user.role });

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('request.jwt.claims', ${claims}, true)`);
    await tx.execute(sql`SET LOCAL ROLE authenticated`);
    c.set('rlsDb', tx as unknown as Database);
    await next();
  });
}
