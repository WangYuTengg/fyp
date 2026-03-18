import { createHash } from 'crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../../db/index.js';
import { questions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';
import { parseCsv } from './csv-utils.js';

const importQuestionsRoute = new Hono<AuthContext>();

function requireStaff(user: { role: string } | null) {
  return user?.role === 'admin' || user?.role === 'staff';
}

const importQuestionRowSchema = z.object({
  type: z.enum(['mcq', 'written', 'uml']),
  title: z.string().min(1, 'Title is required'),
  content: z.record(z.string(), z.unknown()),
  tags: z.array(z.string()).optional().default([]),
  points: z.number().int().min(0).optional().default(10),
  description: z.string().optional().default(''),
});

type ImportQuestionRow = z.infer<typeof importQuestionRowSchema>;

export function computeContentHash(type: string, title: string, content: unknown): string {
  const raw = `${type}|${title}|${JSON.stringify(content)}`;
  return createHash('sha256').update(raw).digest('hex');
}

function csvRowToQuestion(row: Record<string, string>): ImportQuestionRow | { error: string } {
  try {
    let content: Record<string, unknown>;
    try {
      content = JSON.parse(row.content || '{}');
    } catch {
      return { error: `Invalid JSON in content column for "${row.title}"` };
    }

    const tags = row.tags ? row.tags.split(';').map((t) => t.trim()).filter(Boolean) : [];
    const points = row.points ? Number(row.points) : 10;

    const parsed = importQuestionRowSchema.safeParse({
      type: row.type,
      title: row.title,
      content,
      tags,
      points: Number.isFinite(points) ? points : 10,
      description: row.description || '',
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return { error: `${firstError?.path.join('.')}: ${firstError?.message}` };
    }

    return parsed.data;
  } catch (err) {
    return { error: `Failed to parse row: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// Import questions for a course (multipart upload or JSON body)
importQuestionsRoute.post('/course/:courseId/import', requireAuth, async (c) => {
  const user = c.get('user');
  if (!requireStaff(user)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const courseId = c.req.param('courseId');
  const contentType = c.req.header('content-type') || '';

  const questionsToImport: ImportQuestionRow[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  if (contentType.includes('multipart/form-data')) {
    // CSV file upload
    const formData = await c.req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    const text = await file.text();
    const csvRows = parseCsv(text);

    if (csvRows.length === 0) {
      return c.json({ error: 'CSV file is empty or has no data rows' }, 400);
    }

    for (let i = 0; i < csvRows.length; i++) {
      const result = csvRowToQuestion(csvRows[i]);
      if ('error' in result) {
        errors.push({ row: i + 2, error: result.error }); // +2 for 1-indexed + header
      } else {
        questionsToImport.push(result);
      }
    }
  } else if (contentType.includes('application/json')) {
    // JSON body
    const body = await c.req.json();
    const items = Array.isArray(body) ? body : body.questions;

    if (!Array.isArray(items)) {
      return c.json({ error: 'Expected an array of questions or { questions: [...] }' }, 400);
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // If content is a string, try to parse it as JSON
      let content = item.content;
      if (typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch {
          errors.push({ row: i + 1, error: `Invalid JSON in content field for "${item.title}"` });
          continue;
        }
      }

      const parsed = importQuestionRowSchema.safeParse({ ...item, content });
      if (!parsed.success) {
        const firstError = parsed.error.issues[0];
        errors.push({ row: i + 1, error: `${firstError?.path.join('.')}: ${firstError?.message}` });
      } else {
        questionsToImport.push(parsed.data);
      }
    }
  } else {
    return c.json({ error: 'Unsupported content type. Use multipart/form-data (CSV) or application/json.' }, 400);
  }

  if (questionsToImport.length === 0) {
    return c.json({ error: 'No valid questions to import', validationErrors: errors }, 400);
  }

  // Check for duplicates by content hash
  const existingQuestions = await db
    .select({
      id: questions.id,
      type: questions.type,
      title: questions.title,
      content: questions.content,
    })
    .from(questions)
    .where(eq(questions.courseId, courseId));

  const existingHashes = new Set(
    existingQuestions.map((q) => computeContentHash(q.type, q.title, q.content))
  );

  const newQuestions: ImportQuestionRow[] = [];
  const duplicates: string[] = [];

  for (const q of questionsToImport) {
    const hash = computeContentHash(q.type, q.title, q.content);
    if (existingHashes.has(hash)) {
      duplicates.push(q.title);
    } else {
      newQuestions.push(q);
      existingHashes.add(hash); // prevent importing same row twice
    }
  }

  // Insert new questions
  let imported = 0;
  if (newQuestions.length > 0) {
    await db.insert(questions).values(
      newQuestions.map((q) => ({
        courseId,
        type: q.type,
        title: q.title,
        description: q.description || null,
        content: q.content,
        points: q.points,
        tags: q.tags?.length ? q.tags : null,
        createdBy: user!.id,
      }))
    );
    imported = newQuestions.length;
  }

  return c.json({
    imported,
    duplicates: duplicates.length,
    duplicatesTitles: duplicates,
    errors: errors.length > 0 ? errors : undefined,
    total: questionsToImport.length,
  });
});

export default importQuestionsRoute;
