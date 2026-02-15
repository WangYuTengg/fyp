import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { assignmentQuestions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';

const reorderQuestionsRoute = new Hono<AuthContext>();

// Reorder questions in an assignment (staff/admin only)
reorderQuestionsRoute.patch('/questions/reorder', requireAuth, async (c) => {
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const { questionLinks } = body as {
    questionLinks?: Array<{ id: string; order: number }>;
  };

  if (!Array.isArray(questionLinks) || questionLinks.length === 0) {
    return c.json({ error: 'questionLinks array required' }, 400);
  }

  // Update all orders in a transaction-like batch
  for (const link of questionLinks) {
    await db
      .update(assignmentQuestions)
      .set({ order: link.order })
      .where(eq(assignmentQuestions.id, link.id));
  }

  return c.json({ success: true });
});

export default reorderQuestionsRoute;
