import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { users } from '../../../db/schema.js';
import { requireAuth, requireRole, type AuthContext } from '../../middleware/auth.js';
import { and, or, eq, sql, isNull, isNotNull, count } from 'drizzle-orm';

const listUsersRoute = new Hono<AuthContext>();

listUsersRoute.get('/', requireAuth, requireRole('admin'), async (c) => {
  const search = (c.req.query('q') || '').trim().toLowerCase();
  const roleFilter = c.req.query('role') as 'admin' | 'staff' | 'student' | undefined;
  const statusFilter = c.req.query('status') as 'active' | 'deactivated' | undefined;
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 20));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        sql`lower(${users.email}) like ${`%${search}%`}`,
        sql`lower(${users.name}) like ${`%${search}%`}`
      )
    );
  }

  if (roleFilter && ['admin', 'staff', 'student'].includes(roleFilter)) {
    conditions.push(eq(users.role, roleFilter));
  }

  if (statusFilter === 'active') {
    conditions.push(isNull(users.deactivatedAt));
  } else if (statusFilter === 'deactivated') {
    conditions.push(isNotNull(users.deactivatedAt));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [totalResult]] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        deactivatedAt: users.deactivatedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(users.createdAt)
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(users)
      .where(whereClause),
  ]);

  return c.json({
    users: rows,
    pagination: {
      page,
      limit,
      total: totalResult.total,
      totalPages: Math.ceil(totalResult.total / limit),
    },
  });
});

export default listUsersRoute;
