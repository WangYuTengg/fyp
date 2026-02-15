import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { questions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';

const deleteQuestionRoute = new Hono<AuthContext>();

function requireStaff(user: { role: string } | null) {
  return user?.role === 'admin' || user?.role === 'staff';
}

// Delete a question (staff/admin only)
deleteQuestionRoute.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  if (!requireStaff(user)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const id = c.req.param('id');

  const [deleted] = await db
    .delete(questions)
    .where(eq(questions.id, id))
    .returning();

  if (!deleted) {
    return c.json({ error: 'Question not found' }, 404);
  }

  return c.json({ success: true });
});

export default deleteQuestionRoute;
