import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { assignments, submissions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { count, eq } from 'drizzle-orm';

const publishAssignmentRoute = new Hono<AuthContext>();

// Publish/unpublish an assignment
publishAssignmentRoute.patch('/:id/publish', requireAuth, async (c) => {
  const assignmentId = c.req.param('id');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const { isPublished } = body as { isPublished?: unknown };

  if (typeof isPublished !== 'boolean') {
    return c.json({ error: 'isPublished must be a boolean' }, 400);
  }

  const [existingAssignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (!existingAssignment) {
    return c.json({ error: 'Assignment not found' }, 404);
  }

  const isUnpublishAttempt = existingAssignment.isPublished && !isPublished;

  if (isUnpublishAttempt) {
    const [{ value: submissionCount }] = await db
      .select({ value: count() })
      .from(submissions)
      .where(eq(submissions.assignmentId, assignmentId));

    if (submissionCount > 0) {
      return c.json(
        {
          error: 'Cannot unpublish assignment after students have started attempting it.',
        },
        409
      );
    }
  }

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
