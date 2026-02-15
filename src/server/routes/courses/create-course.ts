import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { courses } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';

const createCourseRoute = new Hono<AuthContext>();

// Create a new course (staff/admin only)
createCourseRoute.post('/', requireAuth, async (c) => {
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const { code, name, description, academicYear, semester } = body;

  if (!code || !name || !academicYear || !semester) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const [course] = await db
    .insert(courses)
    .values({
      code,
      name,
      description,
      academicYear,
      semester,
      isActive: true,
    })
    .returning();

  return c.json(course, 201);
});

export default createCourseRoute;
