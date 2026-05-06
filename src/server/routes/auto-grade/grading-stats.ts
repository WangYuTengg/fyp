import { Hono } from 'hono';
import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { submissions, marks } from '../../../db/schema.js';
import { authMiddleware, type AuthContext } from '../../middleware/auth.js';
import { getErrorMessage } from '../../lib/error-utils.js';

const gradingStatsRoute = new Hono<AuthContext>();

/**
 * GET /api/auto-grade/grading-stats
 *
 * Returns top-line submission grading counts for the staff Analytics tab:
 * - autoGradedThisWeek: distinct submissions that received any AI-assisted mark in the last 7 days
 * - pendingReview: submissions awaiting human review (status submitted/grading)
 * - totalGraded: all-time count of submissions in 'graded' status
 */
gradingStatsRoute.get('/grading-stats', authMiddleware, async (c) => {
  const user = c.get('user');

  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [autoGradedRow] = await db
      .select({ value: sql<number>`COUNT(DISTINCT ${marks.submissionId})::int` })
      .from(marks)
      .where(and(eq(marks.isAiAssisted, true), gte(marks.createdAt, sevenDaysAgo)));

    const [pendingRow] = await db
      .select({ value: sql<number>`COUNT(*)::int` })
      .from(submissions)
      .where(sql`${submissions.status} IN ('submitted', 'grading', 'late')`);

    const [totalRow] = await db
      .select({ value: sql<number>`COUNT(*)::int` })
      .from(submissions)
      .where(eq(submissions.status, 'graded'));

    return c.json({
      autoGradedThisWeek: autoGradedRow?.value ?? 0,
      pendingReview: pendingRow?.value ?? 0,
      totalGraded: totalRow?.value ?? 0,
    });
  } catch (error: unknown) {
    console.error('Grading stats error:', error);
    return c.json({ error: 'Failed to fetch grading stats', details: getErrorMessage(error) }, 500);
  }
});

export default gradingStatsRoute;
