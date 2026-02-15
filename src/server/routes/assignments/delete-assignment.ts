import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { assignments } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';

const deleteAssignmentRoute = new Hono<AuthContext>();

// Delete an assignment (staff/admin only)
deleteAssignmentRoute.delete('/:id', requireAuth, async (c) => {
  const assignmentId = c.req.param('id');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const [deleted] = await db
    .delete(assignments)
    .where(eq(assignments.id, assignmentId))
    .returning();

  if (!deleted) {
    return c.json({ error: 'Assignment not found' }, 404);
  }

  return c.json({ success: true });
});

export default deleteAssignmentRoute;
