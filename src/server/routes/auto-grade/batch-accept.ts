import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { answers, marks, questions, submissions } from '../../../db/schema.js';
import { authMiddleware, type AuthContext } from '../../middleware/auth.js';
import { eq, and, isNull, isNotNull, sql } from 'drizzle-orm';
import { getAiGradingSuggestion } from '../../lib/content-utils.js';
import { getErrorMessage } from '../../lib/error-utils.js';
import { z } from 'zod';

const batchAcceptRoute = new Hono<AuthContext>();

const batchAcceptSchema = z.object({
  answerIds: z.array(z.string().uuid()).min(1).max(500),
});

/**
 * POST /api/auto-grade/batch-accept
 *
 * Accept multiple AI grading suggestions in a single transaction.
 * Creates official marks for each accepted suggestion.
 */
batchAcceptRoute.post('/batch-accept', authMiddleware, async (c) => {
  const user = c.get('user');

  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const body = await c.req.json();
  const validation = batchAcceptSchema.safeParse(body);

  if (!validation.success) {
    return c.json({ error: 'Invalid request', details: validation.error.flatten() }, 400);
  }

  const { answerIds } = validation.data;

  try {
    // Fetch all answers with AI suggestions
    const answersWithSuggestions = await db
      .select({
        id: answers.id,
        submissionId: answers.submissionId,
        aiGradingSuggestion: answers.aiGradingSuggestion,
        maxPoints: questions.points,
      })
      .from(answers)
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .where(
        and(
          sql`${answers.id} IN (${sql.join(answerIds.map((id) => sql`${id}`), sql`, `)})`,
          isNotNull(answers.aiGradingSuggestion)
        )
      );

    // Filter out answers that already have marks
    const existingMarks = await db
      .select({ answerId: marks.answerId })
      .from(marks)
      .where(
        sql`${marks.answerId} IN (${sql.join(answerIds.map((id) => sql`${id}`), sql`, `)})`
      );

    const markedAnswerIds = new Set(existingMarks.map((m) => m.answerId));

    const toAccept = answersWithSuggestions.filter(
      (a) => !markedAnswerIds.has(a.id) && a.aiGradingSuggestion
    );

    if (toAccept.length === 0) {
      return c.json({ success: true, accepted: 0, skipped: answerIds.length });
    }

    // Insert all marks in batch
    const markValues = toAccept.map((a) => {
      const suggestion = getAiGradingSuggestion(a.aiGradingSuggestion);
      return {
        submissionId: a.submissionId,
        answerId: a.id,
        points: suggestion?.points ?? 0,
        maxPoints: a.maxPoints,
        feedback: suggestion?.reasoning ?? null,
        markedBy: user.id,
        isAiAssisted: true,
        aiSuggestionAccepted: true,
      };
    });

    const createdMarks = await db.insert(marks).values(markValues).returning();

    // Collect unique submission IDs to potentially update status
    const submissionIds = [...new Set(toAccept.map((a) => a.submissionId))];

    // Check if all answers in each submission now have marks, if so mark as graded
    for (const subId of submissionIds) {
      const [answerCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(answers)
        .where(eq(answers.submissionId, subId));

      const [markCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(marks)
        .where(eq(marks.submissionId, subId));

      if (markCount.count >= answerCount.count) {
        await db
          .update(submissions)
          .set({ status: 'graded', gradedAt: new Date(), updatedAt: new Date() })
          .where(eq(submissions.id, subId));
      }
    }

    return c.json({
      success: true,
      accepted: createdMarks.length,
      skipped: answerIds.length - toAccept.length,
    });
  } catch (error: unknown) {
    console.error('Batch accept error:', error);
    return c.json({ error: 'Failed to batch accept', details: getErrorMessage(error) }, 500);
  }
});

export default batchAcceptRoute;
