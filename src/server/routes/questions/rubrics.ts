import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { rubrics, questions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getErrorMessage } from '../../lib/error-utils.js';

const rubricLevelSchema = z.object({
  label: z.string().min(1),
  points: z.number().int().min(0),
  description: z.string().optional(),
});

const rubricCriterionSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1),
  maxPoints: z.number().int().min(1),
  levels: z.array(rubricLevelSchema).min(1).optional(),
});

const rubricSchema = z.object({
  criteria: z.array(rubricCriterionSchema).min(1),
});

const rubricsRoute = new Hono<AuthContext>();

/**
 * GET /api/questions/:questionId/rubrics
 */
rubricsRoute.get('/:questionId/rubrics', requireAuth, async (c) => {
  const questionId = c.req.param('questionId');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    const [rubric] = await db
      .select()
      .from(rubrics)
      .where(eq(rubrics.questionId, questionId))
      .limit(1);

    if (!rubric) {
      return c.json({ rubric: null });
    }

    return c.json({ rubric });
  } catch (error: unknown) {
    return c.json({ error: 'Failed to fetch rubric', details: getErrorMessage(error) }, 500);
  }
});

/**
 * POST /api/questions/:questionId/rubrics
 * Create or replace a rubric for a question.
 */
rubricsRoute.post('/:questionId/rubrics', requireAuth, async (c) => {
  const questionId = c.req.param('questionId');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const validation = rubricSchema.safeParse(body);

  if (!validation.success) {
    return c.json({ error: 'Invalid rubric data', details: validation.error.flatten() }, 400);
  }

  try {
    // Verify question exists
    const [question] = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    if (!question) {
      return c.json({ error: 'Question not found' }, 404);
    }

    const { criteria } = validation.data;

    // Assign IDs to criteria that don't have them
    const criteriaWithIds = criteria.map((c, i) => ({
      ...c,
      id: c.id || `criterion-${i + 1}`,
    }));

    const totalPoints = criteriaWithIds.reduce((sum, c) => sum + c.maxPoints, 0);

    // Upsert: delete existing + insert new
    const [existing] = await db
      .select({ id: rubrics.id })
      .from(rubrics)
      .where(eq(rubrics.questionId, questionId))
      .limit(1);

    let rubric;
    if (existing) {
      [rubric] = await db
        .update(rubrics)
        .set({
          criteria: criteriaWithIds,
          totalPoints,
          updatedAt: new Date(),
        })
        .where(eq(rubrics.id, existing.id))
        .returning();
    } else {
      [rubric] = await db
        .insert(rubrics)
        .values({
          questionId,
          criteria: criteriaWithIds,
          totalPoints,
        })
        .returning();
    }

    return c.json({ success: true, rubric });
  } catch (error: unknown) {
    return c.json({ error: 'Failed to save rubric', details: getErrorMessage(error) }, 500);
  }
});

/**
 * DELETE /api/questions/:questionId/rubrics
 */
rubricsRoute.delete('/:questionId/rubrics', requireAuth, async (c) => {
  const questionId = c.req.param('questionId');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    await db.delete(rubrics).where(eq(rubrics.questionId, questionId));
    return c.json({ success: true });
  } catch (error: unknown) {
    return c.json({ error: 'Failed to delete rubric', details: getErrorMessage(error) }, 500);
  }
});

export default rubricsRoute;
