import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { courses, enrollments } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, and } from 'drizzle-orm';

const enrollRoute = new Hono<AuthContext>();

// Enroll a user in a course
enrollRoute.post('/:id/enroll', requireAuth, async (c) => {
  const courseId = c.req.param('id');
  const user = c.get('user')!;
  const body = await c.req.json();

  // Only staff/admin can enroll others; students can self-enroll if allowed
  const targetUserId = body.userId || user.id;
  const enrollmentRole = body.role || 'student';

  if (targetUserId !== user.id && user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Cannot enroll other users' }, 403);
  }

  // Check if course exists
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!course) {
    return c.json({ error: 'Course not found' }, 404);
  }

  // Check if already enrolled
  const [existing] = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, targetUserId),
        eq(enrollments.courseId, courseId)
      )
    )
    .limit(1);

  if (existing) {
    return c.json({ error: 'Already enrolled' }, 400);
  }

  const [enrollment] = await db
    .insert(enrollments)
    .values({
      userId: targetUserId,
      courseId,
      role: enrollmentRole,
    })
    .returning();

  return c.json(enrollment, 201);
});

export default enrollRoute;
