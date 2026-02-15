import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { questions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { desc, eq, and, or, ilike, sql } from 'drizzle-orm';

const listQuestionsRoute = new Hono<AuthContext>();

function requireStaff(user: { role: string } | null) {
  return user?.role === 'admin' || user?.role === 'staff';
}

// List questions for a course (staff/admin only)
listQuestionsRoute.get('/course/:courseId', requireAuth, async (c) => {
  const user = c.get('user');
  if (!requireStaff(user)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const courseId = c.req.param('courseId');
  const search = c.req.query('search');
  const tagsParam = c.req.query('tags');
  const typesParam = c.req.query('types');

  // Parse comma-separated tags and types
  const tags = tagsParam ? tagsParam.split(',').filter(Boolean) : [];
  const types = typesParam ? typesParam.split(',').filter(Boolean) : [];

  // Build WHERE conditions
  const conditions = [eq(questions.courseId, courseId)];

  // Text search on title and description
  if (search && search.trim()) {
    const searchTerm = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(questions.title, searchTerm),
        ilike(questions.description, searchTerm)
      )!
    );
  }

  // Filter by tags (any match)
  if (tags.length > 0) {
    conditions.push(sql`${questions.tags} && ${tags}`);
  }

  // Filter by question types
  if (types.length > 0) {
    conditions.push(sql`${questions.type} = ANY(${types})`);
  }

  const rows = await db
    .select()
    .from(questions)
    .where(and(...conditions))
    .orderBy(desc(questions.createdAt));

  return c.json(rows);
});

export default listQuestionsRoute;
