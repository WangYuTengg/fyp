import type { Context, Next } from 'hono';
import { sql } from 'drizzle-orm';
import { db, type Database } from '../../db/index.js';
import type { AuthContext } from './auth.js';

/**
 * Middleware that wraps authenticated requests in an RLS-scoped transaction.
 * Sets PostgreSQL session variables so RLS policies enforce access control.
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

  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE app_user`);
    await tx.execute(sql`SET LOCAL app.current_user_id = ${user.id}`);
    await tx.execute(sql`SET LOCAL app.current_user_role = ${user.role}`);
    c.set('rlsDb', tx as unknown as Database);
    await next();
  });
}
