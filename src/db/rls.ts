import { sql } from 'drizzle-orm';
import { db, type Database } from './index.js';

/**
 * Execute a callback within an RLS-scoped transaction.
 * Sets Supabase's request.jwt.claims so auth.uid() and auth.jwt() work
 * in RLS policies, then switches to the `authenticated` role.
 *
 * The DB owner (used by migrations, Graphile Worker) bypasses RLS automatically.
 * Only queries run through this function are subject to RLS policies.
 */
export async function withRLS<T>(
  userId: string,
  userRole: string,
  callback: (tx: Database) => Promise<T>
): Promise<T> {
  const claims = JSON.stringify({ sub: userId, user_role: userRole });

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('request.jwt.claims', ${claims}, true)`);
    await tx.execute(sql`SET LOCAL ROLE authenticated`);
    return callback(tx as unknown as Database);
  });
}
