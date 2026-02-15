import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { assignmentQuestions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';

const removeQuestionRoute = new Hono<AuthContext>();

// Remove a question from an assignment (staff/admin only)
removeQuestionRoute.delete('/questions/:questionLinkId', requireAuth, async (c) => {
  const questionLinkId = c.req.param('questionLinkId');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const [deleted] = await db
    .delete(assignmentQuestions)
    .where(eq(assignmentQuestions.id, questionLinkId))
    .returning();

  if (!deleted) {
    return c.json({ error: 'Assignment question not found' }, 404);
  }

  return c.json({ success: true });
});

export default removeQuestionRoute;
