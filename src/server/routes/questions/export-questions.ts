import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { questions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, desc } from 'drizzle-orm';
import { escapeCsvField } from './csv-utils.js';

const exportQuestionsRoute = new Hono<AuthContext>();

function requireStaff(user: { role: string } | null) {
  return user?.role === 'admin' || user?.role === 'staff';
}

// Export questions for a course as CSV or JSON
exportQuestionsRoute.get('/course/:courseId/export', requireAuth, async (c) => {
  const user = c.get('user');
  if (!requireStaff(user)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const courseId = c.req.param('courseId');
  const format = c.req.query('format') || 'json';

  if (format !== 'csv' && format !== 'json') {
    return c.json({ error: 'Invalid format. Use "csv" or "json".' }, 400);
  }

  const rows = await db
    .select()
    .from(questions)
    .where(eq(questions.courseId, courseId))
    .orderBy(desc(questions.createdAt));

  if (format === 'json') {
    const exportData = rows.map((q) => ({
      type: q.type,
      title: q.title,
      description: q.description,
      content: q.content,
      tags: q.tags,
      points: q.points,
    }));

    return c.json(exportData);
  }

  // CSV format
  const CSV_COLUMNS = ['type', 'title', 'content', 'tags', 'points', 'description'] as const;
  const header = CSV_COLUMNS.join(',');

  const csvRows = rows.map((q) => {
    const contentStr = JSON.stringify(q.content);
    const tagsStr = (q.tags ?? []).join(';');
    return [
      escapeCsvField(q.type),
      escapeCsvField(q.title),
      escapeCsvField(contentStr),
      escapeCsvField(tagsStr),
      String(q.points),
      escapeCsvField(q.description ?? ''),
    ].join(',');
  });

  const csv = [header, ...csvRows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="questions-export.csv"`,
    },
  });
});

export default exportQuestionsRoute;
