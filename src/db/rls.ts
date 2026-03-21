import { sql } from 'drizzle-orm';
import { db, type Database } from './index.js';

/**
 * Execute a callback within an RLS-scoped transaction.
 * Sets the PostgreSQL role to app_user and configures session variables
 * so that RLS policies can enforce access control.
 *
 * The DB owner (used by migrations, Graphile Worker) bypasses RLS automatically.
 * Only queries run through this function are subject to RLS policies.
 */
export async function withRLS<T>(
  userId: string,
  userRole: string,
  callback: (tx: Database) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE app_user`);
    await tx.execute(sql`SET LOCAL app.current_user_id = ${userId}`);
    await tx.execute(sql`SET LOCAL app.current_user_role = ${userRole}`);
    // tx is compatible with Database for all query operations
    return callback(tx as unknown as Database);
  });
}
