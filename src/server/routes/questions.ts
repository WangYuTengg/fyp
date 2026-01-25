import { Hono } from 'hono';
import { db } from '../../db/index.js';
import { questions } from '../../db/schema.js';
import { requireAuth, type AuthContext } from '../middleware/auth.js';
import { desc, eq } from 'drizzle-orm';

type CreateQuestionBody = {
  courseId: string;
  title: string;
  prompt: string;
  points?: number;
};

type UpdateQuestionBody = {
  title?: string;
  prompt?: string;
  points?: number;
};

const app = new Hono<AuthContext>();

function requireStaff(user: { role: string } | null) {
  return user?.role === 'admin' || user?.role === 'staff';
}

// List questions for a course (staff/admin only)
app.get('/course/:courseId', requireAuth, async (c) => {
  const user = c.get('user');
  if (!requireStaff(user)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const courseId = c.req.param('courseId');

  const rows = await db
    .select()
    .from(questions)
    .where(eq(questions.courseId, courseId))
    .orderBy(desc(questions.createdAt));

  return c.json(rows);
});

// Create a question (staff/admin only)
app.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  if (!requireStaff(user)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = (await c.req.json()) as CreateQuestionBody;

  if (!body.courseId || !body.title || !body.prompt) {
    return c.json({ error: 'courseId, title and prompt are required' }, 400);
  }

  const [row] = await db
    .insert(questions)
    .values({
      courseId: body.courseId,
      type: 'written',
      title: body.title,
      content: { prompt: body.prompt },
      points: body.points ?? 10,
      createdBy: user!.id,
      updatedAt: new Date(),
    })
    .returning();

  return c.json(row, 201);
});

// Update a question (staff/admin only)
app.put('/:id', requireAuth, async (c) => {
  const user = c.get('user');
  if (!requireStaff(user)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const id = c.req.param('id');
  const body = (await c.req.json()) as UpdateQuestionBody;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.title === 'string') patch.title = body.title;
  if (typeof body.points === 'number') patch.points = body.points;
  if (typeof body.prompt === 'string') patch.content = { prompt: body.prompt };

  const [updated] = await db
    .update(questions)
    .set(patch)
    .where(eq(questions.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: 'Question not found' }, 404);
  }

  return c.json(updated);
});

// Delete a question (staff/admin only)
app.delete('/:id', requireAuth, async (c) => {
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

export default app;
