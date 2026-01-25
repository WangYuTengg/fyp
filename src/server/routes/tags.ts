import { Hono } from 'hono';
import { db } from '../../db/index.js';
import { questions } from '../../db/schema.js';
import { requireAuth, type AuthContext } from '../middleware/auth.js';
import { eq } from 'drizzle-orm';

const app = new Hono<AuthContext>();

function requireStaff(user: { role: string } | null) {
  return user?.role === 'admin' || user?.role === 'staff';
}

// Get all unique tags for a course
app.get('/course/:courseId', requireAuth, async (c) => {
  const user = c.get('user');
  if (!requireStaff(user)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const courseId = c.req.param('courseId');

  // Get all unique tags from questions in this course
  const rows = await db
    .select({ tags: questions.tags })
    .from(questions)
    .where(eq(questions.courseId, courseId));

  const tagSet = new Set<string>();
  rows.forEach((row) => {
    if (Array.isArray(row.tags)) {
      row.tags.forEach((tag) => {
        if (tag && typeof tag === 'string') {
          tagSet.add(tag);
        }
      });
    }
  });

  const uniqueTags = Array.from(tagSet).sort();
  return c.json(uniqueTags);
});

export default app;
