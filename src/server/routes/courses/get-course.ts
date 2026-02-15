import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { courses, enrollments } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, and } from 'drizzle-orm';

const getCourseRoute = new Hono<AuthContext>();

// Get a single course by ID
getCourseRoute.get('/:id', requireAuth, async (c) => {
  const courseId = c.req.param('id');
  const user = c.get('user')!;

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!course) {
    return c.json({ error: 'Course not found' }, 404);
  }

  // Check if user has access
  if (user.role !== 'admin' && user.role !== 'staff') {
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.userId, user.id),
          eq(enrollments.courseId, courseId)
        )
      )
      .limit(1);

    if (!enrollment) {
      return c.json({ error: 'Not enrolled in this course' }, 403);
    }
  }

  return c.json(course);
});

export default getCourseRoute;
