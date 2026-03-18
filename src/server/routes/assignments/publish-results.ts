import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { assignments, submissions, marks, answers, questions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, and, sql } from 'drizzle-orm';
import { getErrorMessage } from '../../lib/error-utils.js';

const publishResultsRoute = new Hono<AuthContext>();

/**
 * POST /api/assignments/:id/publish-results
 *
 * Publish or unpublish grade results for students.
 */
publishResultsRoute.post('/:id/publish-results', requireAuth, async (c) => {
  const assignmentId = c.req.param('id');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json() as { publish: boolean };

  if (typeof body.publish !== 'boolean') {
    return c.json({ error: 'publish field (boolean) is required' }, 400);
  }

  try {
    const [assignment] = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (!assignment) {
      return c.json({ error: 'Assignment not found' }, 404);
    }

    const [updated] = await db
      .update(assignments)
      .set({
        resultsPublished: body.publish,
        resultsPublishedAt: body.publish ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(assignments.id, assignmentId))
      .returning({
        id: assignments.id,
        resultsPublished: assignments.resultsPublished,
        resultsPublishedAt: assignments.resultsPublishedAt,
      });

    return c.json({ success: true, ...updated });
  } catch (error: unknown) {
    console.error('Publish results error:', error);
    return c.json({ error: 'Failed to update results visibility', details: getErrorMessage(error) }, 500);
  }
});

/**
 * GET /api/assignments/:id/grading-progress
 *
 * Get grading progress statistics for an assignment.
 */
publishResultsRoute.get('/:id/grading-progress', requireAuth, async (c) => {
  const assignmentId = c.req.param('id');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    const [assignment] = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        resultsPublished: assignments.resultsPublished,
        resultsPublishedAt: assignments.resultsPublishedAt,
      })
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (!assignment) {
      return c.json({ error: 'Assignment not found' }, 404);
    }

    // Get all submitted/late submissions (not draft)
    const allSubmissions = await db
      .select({
        id: submissions.id,
        status: submissions.status,
      })
      .from(submissions)
      .where(
        and(
          eq(submissions.assignmentId, assignmentId),
          sql`${submissions.status} != 'draft'`
        )
      );

    const totalSubmissions = allSubmissions.length;
    const gradedSubmissions = allSubmissions.filter((s) => s.status === 'graded').length;
    const pendingSubmissions = totalSubmissions - gradedSubmissions;

    // Get per-question breakdown
    const questionStats = await db
      .select({
        questionId: questions.id,
        questionTitle: questions.title,
        questionType: questions.type,
        maxPoints: questions.points,
        totalAnswers: sql<number>`count(${answers.id})::int`,
        gradedAnswers: sql<number>`count(${marks.id})::int`,
        avgScore: sql<number>`coalesce(avg(${marks.points}), 0)`,
        aiGradedCount: sql<number>`count(case when ${answers.aiGradingSuggestion} is not null then 1 end)::int`,
        aiAcceptedCount: sql<number>`count(case when ${marks.aiSuggestionAccepted} = true then 1 end)::int`,
        overrideCount: sql<number>`count(case when ${marks.overrideReason} is not null then 1 end)::int`,
      })
      .from(answers)
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .innerJoin(submissions, eq(answers.submissionId, submissions.id))
      .leftJoin(marks, and(eq(marks.answerId, answers.id), eq(marks.submissionId, answers.submissionId)))
      .where(
        and(
          eq(submissions.assignmentId, assignmentId),
          sql`${submissions.status} != 'draft'`
        )
      )
      .groupBy(questions.id, questions.title, questions.type, questions.points);

    // Grade distribution for pre-publish summary
    const gradeDistribution = await db
      .select({
        totalPoints: sql<number>`sum(${marks.points})::int`,
        maxPoints: sql<number>`sum(${marks.maxPoints})::int`,
      })
      .from(marks)
      .innerJoin(submissions, eq(marks.submissionId, submissions.id))
      .where(
        and(
          eq(submissions.assignmentId, assignmentId),
          sql`${submissions.status} = 'graded'`
        )
      )
      .groupBy(submissions.id);

    const scores = gradeDistribution
      .filter((g) => g.maxPoints > 0)
      .map((g) => (g.totalPoints / g.maxPoints) * 100);

    const mean = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const sorted = [...scores].sort((a, b) => a - b);
    const median = sorted.length > 0
      ? sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)]
      : 0;
    const passCount = scores.filter((s) => s >= 50).length;
    const failCount = scores.filter((s) => s < 50).length;

    return c.json({
      assignment: {
        id: assignment.id,
        title: assignment.title,
        resultsPublished: assignment.resultsPublished,
        resultsPublishedAt: assignment.resultsPublishedAt,
      },
      summary: {
        totalSubmissions,
        gradedSubmissions,
        pendingSubmissions,
      },
      questionStats,
      gradeDistribution: {
        mean: Math.round(mean * 10) / 10,
        median: Math.round(median * 10) / 10,
        passCount,
        failCount,
        scores,
      },
    });
  } catch (error: unknown) {
    console.error('Grading progress error:', error);
    return c.json({ error: 'Failed to fetch grading progress', details: getErrorMessage(error) }, 500);
  }
});

export default publishResultsRoute;
