import { Hono } from 'hono';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import {
  answers,
  marks,
  questions,
  submissions,
  users,
} from '../../../db/schema.js';
import { authMiddleware, type AuthContext } from '../../middleware/auth.js';
import { getErrorMessage } from '../../lib/error-utils.js';
import { errorResponse, ErrorCodes } from '../../lib/errors.js';

const reviewQueueRoute = new Hono<AuthContext>();

/**
 * GET /api/auto-grade/review-queue
 *
 * Returns answers with AI grading suggestions that have not yet been
 * accepted or rejected (no corresponding mark exists).
 */
reviewQueueRoute.get('/review-queue', authMiddleware, async (c) => {
  const user = c.get('user');

  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    return c.json(errorResponse('Unauthorized', undefined, ErrorCodes.UNAUTHORIZED), 403);
  }

  const assignmentId = c.req.query('assignmentId');
  if (!assignmentId) {
    return c.json(errorResponse('assignmentId is required'), 400);
  }

  try {
    // Get submitted/late submissions for this assignment
    const submissionList = await db
      .select({
        id: submissions.id,
        userId: submissions.userId,
      })
      .from(submissions)
      .where(
        and(
          eq(submissions.assignmentId, assignmentId),
          inArray(submissions.status, ['submitted', 'late'])
        )
      );

    if (submissionList.length === 0) {
      return c.json({ answers: [] });
    }

    const submissionIds = submissionList.map(s => s.id);

    // Get all answers with AI suggestions for these submissions
    const aiGradedAnswers = await db
      .select({
        id: answers.id,
        submissionId: answers.submissionId,
        questionId: answers.questionId,
        content: answers.content,
        aiGradingSuggestion: answers.aiGradingSuggestion,
        questionTitle: questions.title,
        questionType: questions.type,
        questionContent: questions.content,
        questionPoints: questions.points,
      })
      .from(answers)
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .where(
        and(
          inArray(answers.submissionId, submissionIds),
          inArray(questions.type, ['written', 'uml']),
          isNotNull(answers.aiGradingSuggestion)
        )
      );

    // Get existing marks to filter out already-reviewed answers
    const existingMarks = await db
      .select({ answerId: marks.answerId })
      .from(marks)
      .where(inArray(marks.submissionId, submissionIds));

    const markedAnswerIds = new Set(existingMarks.map(m => m.answerId));

    // Get user info for submissions
    const userIds = [...new Set(submissionList.map(s => s.userId))];
    const userList = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
      })
      .from(users)
      .where(inArray(users.id, userIds));

    const userMap = new Map(userList.map(u => [u.id, u]));
    const submissionUserMap = new Map(submissionList.map(s => [s.id, s.userId]));

    // Filter to only unreviewed answers and format response
    const reviewAnswers = aiGradedAnswers
      .filter(a => !markedAnswerIds.has(a.id))
      .map(a => {
        const userId = submissionUserMap.get(a.submissionId);
        const studentUser = userId ? userMap.get(userId) : undefined;

        return {
          id: a.id,
          submissionId: a.submissionId,
          questionId: a.questionId,
          content: a.content,
          aiGradingSuggestion: a.aiGradingSuggestion,
          question: {
            id: a.questionId,
            title: a.questionTitle,
            type: a.questionType,
            content: a.questionContent,
            points: a.questionPoints,
          },
          student: {
            name: studentUser?.name || null,
            email: studentUser?.email || '',
          },
        };
      });

    return c.json({ answers: reviewAnswers });
  } catch (error: unknown) {
    console.error('Review queue error:', error);
    return c.json({ error: 'Failed to fetch review queue', details: getErrorMessage(error) }, 500);
  }
});

export default reviewQueueRoute;
