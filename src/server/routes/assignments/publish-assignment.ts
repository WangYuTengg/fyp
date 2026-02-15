import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { assignments } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';

const publishAssignmentRoute = new Hono<AuthContext>();

// Publish/unpublish an assignment
publishAssignmentRoute.patch('/:id/publish', requireAuth, async (c) => {
  const assignmentId = c.req.param('id');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const { isPublished } = body;

  const [updated] = await db
    .update(assignments)
    .set({ isPublished, updatedAt: new Date() })
    .where(eq(assignments.id, assignmentId))
    .returning();

  if (!updated) {
    return c.json({ error: 'Assignment not found' }, 404);
  }

  return c.json(updated);
});

export default publishAssignmentRoute;
