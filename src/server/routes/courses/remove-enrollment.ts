import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { enrollments } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, and } from 'drizzle-orm';

const removeEnrollmentRoute = new Hono<AuthContext>();

// Remove an enrollment from a course (staff/admin only)
removeEnrollmentRoute.delete('/:id/enrollments/:enrollmentId', requireAuth, async (c) => {
  const courseId = c.req.param('id');
  const enrollmentId = c.req.param('enrollmentId');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const [enrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.id, enrollmentId),
        eq(enrollments.courseId, courseId)
      )
    )
    .limit(1);

  if (!enrollment) {
    return c.json({ error: 'Enrollment not found' }, 404);
  }

  await db
    .delete(enrollments)
    .where(eq(enrollments.id, enrollmentId));

  return c.json({ success: true });
});

export default removeEnrollmentRoute;
