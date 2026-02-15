import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { answers, aiGradingJobs, questions, submissions } from '../../../db/schema.js';
import { authMiddleware, type AuthContext } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';
import { singleAutoGradeSchema } from '../../lib/validation-schemas.js';
import { errorResponse, ErrorCodes } from '../../lib/errors.js';
import { addJob } from '../../lib/worker.js';

const singleRoute = new Hono<AuthContext>();

/**
 * POST /api/auto-grade/single
 * 
 * Trigger auto-grading for a single answer.
 * Useful for re-grading or grading with custom rubric.
 */
singleRoute.post('/single', authMiddleware, async (c) => {
  const user = c.get('user');

  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const body = await c.req.json();

  const validation = singleAutoGradeSchema.safeParse(body);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return c.json(
      errorResponse(
        'Validation failed',
        { field: firstError?.path.join('.'), message: firstError?.message },
        ErrorCodes.VALIDATION_ERROR
      ),
      400
    );
  }

  const { answerId, rubric, forceRegrade } = validation.data;

  try {
    // Fetch answer with question info
    const [answerData] = await db
      .select({
        id: answers.id,
        questionId: answers.questionId,
        submissionId: answers.submissionId,
        aiGradingSuggestion: answers.aiGradingSuggestion,
        questionType: questions.type,
        userId: submissions.userId,
      })
      .from(answers)
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .innerJoin(submissions, eq(answers.submissionId, submissions.id))
      .where(eq(answers.id, answerId))
      .limit(1);

    if (!answerData) {
      return c.json({ error: 'Answer not found' }, 404);
    }

    // Check if already graded
    if (answerData.aiGradingSuggestion && !forceRegrade) {
      return c.json({
        error: 'Answer already has AI grading suggestion. Set forceRegrade=true to re-grade.',
        existingSuggestion: answerData.aiGradingSuggestion,
      }, 400);
    }

    // Clear existing AI suggestion if regrading
    if (forceRegrade && answerData.aiGradingSuggestion) {
      await db.update(answers)
        .set({ aiGradingSuggestion: null })
        .where(eq(answers.id, answerId));
    }

    // Determine task name
    const taskName = answerData.questionType === 'written' ? 'auto-grade-written' : 'auto-grade-uml';

    // Create job record
    const [jobRecord] = await db
      .insert(aiGradingJobs)
      .values({
        answerId,
        status: 'pending',
        tokensUsed: 0,
        cost: '0',
      })
      .returning();

    // Queue job
    await addJob(taskName, {
      answerId,
      questionId: answerData.questionId,
      submissionId: answerData.submissionId,
      userId: answerData.userId,
      jobId: jobRecord.id,
      rubricOverride: rubric || undefined,
    });

    return c.json({
      success: true,
      jobId: jobRecord.id,
      message: `Queued auto-grading for answer ${answerId}`,
    });
  } catch (error: any) {
    console.error('Single auto-grade error:', error);
    return c.json({ error: 'Failed to queue auto-grading job', details: error.message }, 500);
  }
});

export default singleRoute;
