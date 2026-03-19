import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { db } from '../../../db/index.js';
import { questions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';

type McqOption = {
  id?: string;
  text?: string;
  isCorrect?: boolean;
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
  modelAnswer?: string;
};

const updateQuestionRoute = new Hono<AuthContext>();

function requireStaff(user: { role: string } | null) {
  return user?.role === 'admin' || user?.role === 'staff';
}

// Update a question (staff/admin only)
updateQuestionRoute.put('/:id', requireAuth, async (c) => {
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
      patch.content = {
        prompt,
        modelAnswer: body.modelAnswer?.trim() || (existingContent.modelAnswer as string | undefined) || undefined,
      };
    } else if (body.modelAnswer !== undefined) {
      patch.content = {
        prompt: (existingContent.prompt as string | undefined) ?? '',
        modelAnswer: body.modelAnswer.trim() || undefined,
      };
    }
  }

  if (existing.type === 'uml') {
    const referenceDiagram = typeof body.referenceDiagram === 'string'
      ? body.referenceDiagram.trim()
      : (existingContent.referenceDiagram as string | undefined) ?? '';
    const modelAnswer = typeof body.modelAnswer === 'string'
      ? body.modelAnswer.trim()
      : (existingContent.modelAnswer as string | undefined) ?? undefined;
    const updatedPrompt = prompt ?? (existingContent.prompt as string | undefined) ?? '';

    if (prompt !== undefined || body.referenceDiagram !== undefined || body.modelAnswer !== undefined) {
      const hasAnyDiagram =
        (referenceDiagram && referenceDiagram.trim().length > 0) ||
        (modelAnswer && modelAnswer.trim().length > 0);
      if (!hasAnyDiagram) {
        return c.json({ error: 'UML question requires an answer diagram (PlantUML code)' }, 400);
      }

      patch.content = {
        prompt: updatedPrompt,
        referenceDiagram,
        modelAnswer,
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
        isCorrect: option.isCorrect ?? false,
      }))
      .filter((option) => option.text.length > 0);

    if (prompt !== undefined || body.options) {
      if (!updatedPrompt) {
        return c.json({ error: 'Prompt is required' }, 400);
      }
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

      const allowMultiple = body.allowMultiple ?? (correctOptionsCount > 1);

      if (!allowMultiple && correctOptionsCount > 1) {
        return c.json({ error: 'Single-answer MCQ can only have one correct option' }, 400);
      }

      if (allowMultiple && correctOptionsCount < 2) {
        return c.json({ error: 'Multiple-answer MCQ requires at least two correct options' }, 400);
      }

      patch.content = {
        prompt: updatedPrompt,
        options,
        allowMultiple,
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

export default updateQuestionRoute;
