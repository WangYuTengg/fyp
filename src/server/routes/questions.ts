import { Hono } from 'hono';
import { db } from '../../db/index.js';
import { questions, assignmentQuestions } from '../../db/schema.js';
import { requireAuth, type AuthContext } from '../middleware/auth.js';
import { desc, eq, and, or, ilike, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

type McqOption = {
  id?: string;
  text?: string;
};

type CreateQuestionBody = {
  courseId: string;
  title: string;
  type: 'mcq' | 'written' | 'uml';
  prompt: string;
  points?: number;
  options?: McqOption[];
  allowMultiple?: boolean;
  assignmentId?: string;
  tags?: string[];
  referenceDiagram?: string;
};

type UpdateQuestionBody = {
  title?: string;
  type?: 'mcq' | 'written' | 'uml';
  prompt?: string;
  points?: number;
  options?: McqOption[];
  allowMultiple?: boolean;
  tags?: string[];
  referenceDiagram?: string;
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

// Create a question (staff/admin only)
app.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  if (!requireStaff(user)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = (await c.req.json()) as CreateQuestionBody;

  if (!body.courseId || !body.title || !body.type) {
    return c.json({ error: 'courseId, title, and type are required' }, 400);
  }

  if (body.allowMultiple) {
    return c.json({ error: 'Multiple-correct MCQ is not supported yet' }, 400);
  }

  if (body.type !== 'mcq' && body.type !== 'written' && body.type !== 'uml') {
    return c.json({ error: 'Invalid question type' }, 400);
  }

  const prompt = (body.prompt || '').trim();

  const points = body.points ?? 10;
  let content: Record<string, unknown> = { prompt };

  if (body.type === 'mcq') {
    const rawOptions = Array.isArray(body.options) ? body.options : [];
    const options = rawOptions
      .map((option) => ({
        id: option.id ?? randomUUID(),
        text: (option.text ?? '').trim(),
      }))
      .filter((option) => option.text.length > 0);

    if (options.length < 2) {
      return c.json({ error: 'MCQ requires at least two options' }, 400);
    }

    content = {
      prompt,
      options,
      allowMultiple: false,
    };
  }

  if (body.type === 'uml') {
    content = {
      prompt,
      referenceDiagram: body.referenceDiagram || '',
    };
  }

  const [row] = await db
    .insert(questions)
    .values({
      courseId: body.courseId,
      type: body.type,
      title: body.title,
      content,
      points,
      tags: body.tags ?? null,
      createdBy: user!.id,
      updatedAt: new Date(),
    })
    .returning();

  // If assignmentId is provided, link the question to the assignment
  if (body.assignmentId) {
    // Get the current max order for questions in this assignment
    const existingQuestions = await db
      .select()
      .from(assignmentQuestions)
      .where(eq(assignmentQuestions.assignmentId, body.assignmentId));

    const nextOrder = existingQuestions.length + 1;

    await db.insert(assignmentQuestions).values({
      assignmentId: body.assignmentId,
      questionId: row.id,
      order: nextOrder,
    });
  }

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

  const [existing] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, id))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Question not found' }, 404);
  }

  if (body.type && body.type !== existing.type) {
    return c.json({ error: 'Changing question type is not supported' }, 400);
  }

  if (body.allowMultiple) {
    return c.json({ error: 'Multiple-correct MCQ is not supported yet' }, 400);
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.title === 'string') patch.title = body.title;
  if (typeof body.points === 'number') patch.points = body.points;
  if (Array.isArray(body.tags)) patch.tags = body.tags;

  const existingContent = (existing.content ?? {}) as Record<string, unknown>;
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : undefined;

  if (existing.type === 'written') {
    if (prompt !== undefined) {
      if (!prompt) {
        return c.json({ error: 'Prompt is required' }, 400);
      }
      patch.content = { prompt };
    }
  }

  if (existing.type === 'uml') {
    const referenceDiagram = typeof body.referenceDiagram === 'string'
      ? body.referenceDiagram.trim()
      : (existingContent.referenceDiagram as string | undefined) ?? '';
    const updatedPrompt = prompt ?? (existingContent.prompt as string | undefined) ?? '';

    if (prompt !== undefined || body.referenceDiagram !== undefined) {
      if (!referenceDiagram) {
        return c.json({ error: 'Reference diagram is required for UML questions' }, 400);
      }
      patch.content = {
        prompt: updatedPrompt,
        referenceDiagram,
      };
    }
  }

  if (existing.type === 'mcq') {
    const rawOptions = Array.isArray(body.options)
      ? body.options
      : (existingContent.options as McqOption[] | undefined) ?? [];
    const updatedPrompt = prompt ?? (existingContent.prompt as string | undefined) ?? '';

    const options = rawOptions
      .map((option) => ({
        id: option.id ?? randomUUID(),
        text: (option.text ?? '').trim(),
      }))
      .filter((option) => option.text.length > 0);

    if (prompt !== undefined || body.options) {
      if (!updatedPrompt) {
        return c.json({ error: 'Prompt is required' }, 400);
      }
      if (options.length < 2) {
        return c.json({ error: 'MCQ requires at least two options' }, 400);
      }

      patch.content = {
        prompt: updatedPrompt,
        options,
        allowMultiple: false,
      };
    }
  }

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
