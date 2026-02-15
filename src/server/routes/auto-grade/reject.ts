import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { answers, marks, questions } from '../../../db/schema.js';
import { authMiddleware, type AuthContext } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';

const rejectRoute = new Hono<AuthContext>();

/**
 * POST /api/auto-grade/:answerId/reject
 * 
 * Reject AI suggestion and provide manual grade.
 */
rejectRoute.post('/:answerId/reject', authMiddleware, async (c) => {
  const user = c.get('user');
  const answerId = c.req.param('answerId');

  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const body = await c.req.json();
  const { points, feedback } = body;

  if (points === undefined || typeof points !== 'number') {
    return c.json({ error: 'Points are required' }, 400);
  }

  try {
    // Fetch answer info
    const [answerData] = await db
      .select({
        id: answers.id,
        submissionId: answers.submissionId,
        maxPoints: questions.points,
      })
      .from(answers)
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .where(eq(answers.id, answerId))
      .limit(1);

    if (!answerData) {
      return c.json({ error: 'Answer not found' }, 404);
    }

    if (points < 0 || points > answerData.maxPoints) {
      return c.json({ error: `Points must be between 0 and ${answerData.maxPoints}` }, 400);
    }

    // Create manual mark (AI suggestion rejected)
    const [mark] = await db
      .insert(marks)
      .values({
        submissionId: answerData.submissionId,
        answerId,
        points,
        maxPoints: answerData.maxPoints,
        feedback: feedback || null,
        markedBy: user.id,
        isAiAssisted: true, // Still AI-assisted (suggestion was shown)
        aiSuggestionAccepted: false, // But rejected
      })
      .returning();

    return c.json({
      success: true,
      markId: mark.id,
      points: mark.points,
      maxPoints: mark.maxPoints,
    });
  } catch (error: any) {
    console.error('Reject AI suggestion error:', error);
    return c.json({ error: 'Failed to save manual grade', details: error.message }, 500);
  }
});

export default rejectRoute;
