import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { users } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { and, eq, or, sql } from 'drizzle-orm';

const listStudentsRoute = new Hono<AuthContext>();

// List students for enrollment (staff/admin only)
listStudentsRoute.get('/', requireAuth, async (c) => {
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const search = (c.req.query('q') || '').trim().toLowerCase();

  const whereClause = search
    ? and(
        eq(users.role, 'student'),
        or(
          sql`lower(${users.email}) like ${`%${search}%`}`,
          sql`lower(${users.name}) like ${`%${search}%`}`
        )
      )
    : eq(users.role, 'student');

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(users)
    .where(whereClause)
    .orderBy(users.email)
    .limit(200);

  return c.json(rows);
});

export default listStudentsRoute;
