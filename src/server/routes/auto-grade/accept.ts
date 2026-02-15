import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { answers, marks, questions } from '../../../db/schema.js';
import { authMiddleware, type AuthContext } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';

const acceptRoute = new Hono<AuthContext>();

/**
 * POST /api/auto-grade/:answerId/accept
 * 
 * Accept AI grading suggestion and create official mark.
 */
acceptRoute.post('/:answerId/accept', authMiddleware, async (c) => {
  const user = c.get('user');
  const answerId = c.req.param('answerId');

  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  try {
    // Fetch answer with AI suggestion
    const [answerData] = await db
      .select({
        id: answers.id,
        submissionId: answers.submissionId,
        aiGradingSuggestion: answers.aiGradingSuggestion,
        maxPoints: questions.points,
      })
      .from(answers)
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .where(eq(answers.id, answerId))
      .limit(1);

    if (!answerData) {
      return c.json({ error: 'Answer not found' }, 404);
    }

    const suggestion = answerData.aiGradingSuggestion as any;
    if (!suggestion) {
      return c.json({ error: 'No AI grading suggestion to accept' }, 400);
    }

    // Create mark from AI suggestion
    const [mark] = await db
      .insert(marks)
      .values({
        submissionId: answerData.submissionId,
        answerId,
        points: suggestion.points,
        maxPoints: answerData.maxPoints,
        feedback: suggestion.reasoning,
        markedBy: user.id,
        isAiAssisted: true,
        aiSuggestionAccepted: true,
      })
      .returning();

    return c.json({
      success: true,
      markId: mark.id,
      points: mark.points,
      maxPoints: mark.maxPoints,
    });
  } catch (error: any) {
    console.error('Accept AI suggestion error:', error);
    return c.json({ error: 'Failed to accept AI suggestion', details: error.message }, 500);
  }
});

export default acceptRoute;
