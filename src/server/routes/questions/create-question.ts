import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { db } from '../../../db/index.js';
import { questions, assignmentQuestions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';

type McqOption = {
  id?: string;
  text?: string;
  isCorrect?: boolean;
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
  modelAnswer?: string;
};

const createQuestionRoute = new Hono<AuthContext>();

function requireStaff(user: { role: string } | null) {
  return user?.role === 'admin' || user?.role === 'staff';
}

// Create a question (staff/admin only)
createQuestionRoute.post('/', requireAuth, async (c) => {
  const user = c.get('user');
  if (!requireStaff(user)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = (await c.req.json()) as CreateQuestionBody;

  if (!body.courseId || !body.title || !body.type) {
    return c.json({ error: 'courseId, title, and type are required' }, 400);
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
        isCorrect: option.isCorrect ?? false,
      }))
      .filter((option) => option.text.length > 0);

    if (options.length < 2) {
      return c.json({ error: 'MCQ requires at least two options' }, 400);
    }

    const optionTextSet = new Set<string>();
    for (const option of options) {
      if (optionTextSet.has(option.text)) {
        return c.json({ error: 'MCQ options must be unique' }, 400);
      }
      optionTextSet.add(option.text);
    }

    const correctOptionsCount = options.filter((option) => option.isCorrect).length;
    if (correctOptionsCount === 0) {
      return c.json({ error: 'MCQ requires at least one correct option' }, 400);
    }

    const allowMultiple = body.allowMultiple ?? correctOptionsCount > 1;

    if (!allowMultiple && correctOptionsCount > 1) {
      return c.json({ error: 'Single-answer MCQ can only have one correct option' }, 400);
    }

    if (allowMultiple && correctOptionsCount < 2) {
      return c.json({ error: 'Multiple-answer MCQ requires at least two correct options' }, 400);
    }

    content = {
      prompt,
      options,
      allowMultiple,
    };
  }

  if (body.type === 'written') {
    content = {
      prompt,
      modelAnswer: body.modelAnswer?.trim() || undefined,
    };
  }

  if (body.type === 'uml') {
    content = {
      prompt,
      referenceDiagram: body.referenceDiagram?.trim() || '',
      modelAnswer: body.modelAnswer?.trim() || undefined,
    };

    const hasAnyDiagram =
      (content.referenceDiagram && String(content.referenceDiagram).trim().length > 0) ||
      (content.modelAnswer && String(content.modelAnswer).trim().length > 0);

    if (!hasAnyDiagram) {
      return c.json({ error: 'UML question requires an answer diagram (PlantUML code)' }, 400);
    }
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

export default createQuestionRoute;
