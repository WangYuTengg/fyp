import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import {
  assignments,
  assignmentQuestions,
  questions,
  submissions,
  answers,
  marks,
} from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, inArray } from 'drizzle-orm';
import { errorResponse, ErrorCodes } from '../../lib/errors.js';
import { getErrorMessage } from '../../lib/error-utils.js';
import { percentile, round2, buildScoreDistribution } from '../../lib/analytics-utils.js';

const analyticsRoute = new Hono<AuthContext>();

type QuestionMetrics = {
  questionId: string;
  questionTitle: string;
  questionType: 'mcq' | 'written' | 'coding' | 'uml';
  maxPoints: number;
  order: number;
  totalGraded: number;
  avgScore: number;
  medianScore: number;
  stdDeviation: number;
  minScore: number;
  maxScore: number;
  q1: number;
  q3: number;
  scoreDistribution: Array<{ bucket: string; count: number }>;
  aboveThreshold: number;
  belowThreshold: number;
  thresholdPercent: number;
  aiOverrideRate: number;
  aiAssistedCount: number;
  aiOverriddenCount: number;
};

type AnalyticsResponse = {
  assignmentId: string;
  assignmentTitle: string;
  totalSubmissions: number;
  gradedSubmissions: number;
  overallAvgScore: number;
  overallMedianScore: number;
  questions: QuestionMetrics[];
};

/**
 * GET /api/assignments/:id/analytics
 *
 * Per-question grading analytics for an assignment.
 * Returns avg, median, std dev, score distributions, AI override rates.
 * Staff/admin only.
 */
analyticsRoute.get('/:id/analytics', requireAuth, async (c) => {
  const user = c.get('user')!;

  if (user.role !== 'staff' && user.role !== 'admin') {
    return c.json(errorResponse('Forbidden', undefined, ErrorCodes.FORBIDDEN), 403);
  }

  const assignmentId = c.req.param('id');
  const threshold = Number(c.req.query('threshold') || '50');

  try {
    // Verify assignment exists
    const [assignment] = await db
      .select({ id: assignments.id, title: assignments.title })
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (!assignment) {
      return c.json(errorResponse('Assignment not found', undefined, ErrorCodes.NOT_FOUND), 404);
    }

    // Get assignment questions
    const aqRows = await db
      .select({
        questionId: assignmentQuestions.questionId,
        order: assignmentQuestions.order,
        pointsOverride: assignmentQuestions.points,
        questionTitle: questions.title,
        questionType: questions.type,
        questionPoints: questions.points,
      })
      .from(assignmentQuestions)
      .innerJoin(questions, eq(assignmentQuestions.questionId, questions.id))
      .where(eq(assignmentQuestions.assignmentId, assignmentId))
      .orderBy(assignmentQuestions.order);

    const emptyResponse = (
      totalSubs = 0,
      gradedSubs = 0,
      qs: QuestionMetrics[] = []
    ): AnalyticsResponse => ({
      assignmentId,
      assignmentTitle: assignment.title,
      totalSubmissions: totalSubs,
      gradedSubmissions: gradedSubs,
      overallAvgScore: 0,
      overallMedianScore: 0,
      questions: qs,
    });

    if (aqRows.length === 0) {
      return c.json(emptyResponse());
    }

    // Get submission counts
    const allSubmissions = await db
      .select({ id: submissions.id, status: submissions.status })
      .from(submissions)
      .where(eq(submissions.assignmentId, assignmentId));

    const nonDraftSubmissions = allSubmissions.filter((s) => s.status !== 'draft');
    const totalSubmissions = nonDraftSubmissions.length;
    const gradedSubmissions = allSubmissions.filter((s) => s.status === 'graded').length;
    const submittedIds = nonDraftSubmissions.map((s) => s.id);

    const makeEmptyQuestion = (aq: (typeof aqRows)[0]): QuestionMetrics => ({
      questionId: aq.questionId,
      questionTitle: aq.questionTitle,
      questionType: aq.questionType,
      maxPoints: aq.pointsOverride ?? aq.questionPoints,
      order: aq.order,
      totalGraded: 0,
      avgScore: 0,
      medianScore: 0,
      stdDeviation: 0,
      minScore: 0,
      maxScore: 0,
      q1: 0,
      q3: 0,
      scoreDistribution: [],
      aboveThreshold: 0,
      belowThreshold: 0,
      thresholdPercent: threshold,
      aiOverrideRate: 0,
      aiAssistedCount: 0,
      aiOverriddenCount: 0,
    });

    if (submittedIds.length === 0) {
      return c.json(emptyResponse(0, 0, aqRows.map(makeEmptyQuestion)));
    }

    // Get all marks for submitted submissions, joined with answers to get questionId
    const allMarks = await db
      .select({
        submissionId: marks.submissionId,
        points: marks.points,
        maxPoints: marks.maxPoints,
        isAiAssisted: marks.isAiAssisted,
        aiSuggestionAccepted: marks.aiSuggestionAccepted,
        questionId: answers.questionId,
      })
      .from(marks)
      .innerJoin(answers, eq(marks.answerId, answers.id))
      .where(inArray(marks.submissionId, submittedIds));

    // Group marks by questionId
    const marksByQuestion = new Map<string, typeof allMarks>();
    for (const mark of allMarks) {
      if (!mark.questionId) continue;
      const existing = marksByQuestion.get(mark.questionId) ?? [];
      existing.push(mark);
      marksByQuestion.set(mark.questionId, existing);
    }

    // Calculate per-question metrics
    const questionMetrics: QuestionMetrics[] = aqRows.map((aq) => {
      const qMarks = marksByQuestion.get(aq.questionId) ?? [];
      const maxPts = aq.pointsOverride ?? aq.questionPoints;

      if (qMarks.length === 0) return makeEmptyQuestion(aq);

      const scores = qMarks.map((m) => m.points);
      const sorted = [...scores].sort((a, b) => a - b);
      const n = sorted.length;

      const sum = sorted.reduce((s, v) => s + v, 0);
      const avg = sum / n;
      const median =
        n % 2 === 0
          ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
          : sorted[Math.floor(n / 2)];

      const variance = sorted.reduce((s, v) => s + (v - avg) ** 2, 0) / n;
      const stdDev = Math.sqrt(variance);

      const q1 = percentile(sorted, 25);
      const q3 = percentile(sorted, 75);

      const thresholdScore = (threshold / 100) * maxPts;
      const above = scores.filter((s) => s >= thresholdScore).length;
      const below = scores.filter((s) => s < thresholdScore).length;

      const aiAssisted = qMarks.filter((m) => m.isAiAssisted).length;
      const aiOverridden = qMarks.filter(
        (m) => m.isAiAssisted && m.aiSuggestionAccepted === false
      ).length;
      const aiOverrideRate = aiAssisted > 0 ? aiOverridden / aiAssisted : 0;

      return {
        questionId: aq.questionId,
        questionTitle: aq.questionTitle,
        questionType: aq.questionType,
        maxPoints: maxPts,
        order: aq.order,
        totalGraded: n,
        avgScore: round2(avg),
        medianScore: round2(median),
        stdDeviation: round2(stdDev),
        minScore: sorted[0],
        maxScore: sorted[n - 1],
        q1: round2(q1),
        q3: round2(q3),
        scoreDistribution: buildScoreDistribution(scores, maxPts),
        aboveThreshold: above,
        belowThreshold: below,
        thresholdPercent: threshold,
        aiOverrideRate: round2(aiOverrideRate * 100),
        aiAssistedCount: aiAssisted,
        aiOverriddenCount: aiOverridden,
      };
    });

    // Calculate overall per-submission totals for assignment-level stats
    const submissionScores = new Map<string, { earned: number; max: number }>();
    for (const mark of allMarks) {
      const entry = submissionScores.get(mark.submissionId) ?? { earned: 0, max: 0 };
      entry.earned += mark.points;
      entry.max += mark.maxPoints;
      submissionScores.set(mark.submissionId, entry);
    }

    const totals = [...submissionScores.values()]
      .filter((v) => v.max > 0)
      .map((v) => v.earned);
    const sortedTotals = [...totals].sort((a, b) => a - b);

    const overallAvg =
      sortedTotals.length > 0
        ? sortedTotals.reduce((s, v) => s + v, 0) / sortedTotals.length
        : 0;
    const overallMedian =
      sortedTotals.length > 0
        ? sortedTotals.length % 2 === 0
          ? (sortedTotals[sortedTotals.length / 2 - 1] + sortedTotals[sortedTotals.length / 2]) / 2
          : sortedTotals[Math.floor(sortedTotals.length / 2)]
        : 0;

    return c.json({
      assignmentId,
      assignmentTitle: assignment.title,
      totalSubmissions,
      gradedSubmissions,
      overallAvgScore: round2(overallAvg),
      overallMedianScore: round2(overallMedian),
      questions: questionMetrics,
    } satisfies AnalyticsResponse);
  } catch (error: unknown) {
    console.error('Analytics error:', error);
    return c.json(
      errorResponse('Failed to fetch analytics', getErrorMessage(error), ErrorCodes.INTERNAL_ERROR),
      500
    );
  }
});

export default analyticsRoute;
