import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { enrollments, users } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, desc } from 'drizzle-orm';

const listEnrollmentsRoute = new Hono<AuthContext>();

// Get enrollments for a course (staff/admin only)
listEnrollmentsRoute.get('/:id/enrollments', requireAuth, async (c) => {
  const courseId = c.req.param('id');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const courseEnrollments = await db
    .select({
      id: enrollments.id,
      role: enrollments.role,
      createdAt: enrollments.createdAt,
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
      },
    })
    .from(enrollments)
    .innerJoin(users, eq(enrollments.userId, users.id))
    .where(eq(enrollments.courseId, courseId))
    .orderBy(desc(enrollments.createdAt));

  return c.json(courseEnrollments);
});

export default listEnrollmentsRoute;
