import { Hono } from 'hono';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  assignments,
  submissions,
  answers,
  questions,
  assignmentQuestions,
  aiGradingJobs,
  aiUsageStats,
  enrollments,
  marks,
  courses,
} from '../../db/schema.js';
import { authMiddleware, type AuthContext } from '../middleware/auth.js';
import { validateAssignmentHasAnswers } from '../lib/validators.js';
import { addJob } from '../lib/worker.js';
import { randomUUID } from 'crypto';
import { batchAutoGradeSchema, singleAutoGradeSchema } from '../lib/validation-schemas.js';
import { errorResponse, ErrorCodes } from '../lib/errors.js';

const app = new Hono<AuthContext>();

/**
 * POST /api/auto-grade/batch
 * 
 * Trigger batch auto-grading for an assignment.
 * Queues jobs for all ungraded written/UML questions.
 */
app.post('/batch', authMiddleware, async (c) => {
  const user = c.get('user');
  
  // Only staff/admin can trigger auto-grading
  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    return c.json(errorResponse('Unauthorized', undefined, ErrorCodes.UNAUTHORIZED), 403);
  }

  const body = await c.req.json();
  
  // Validate request body
  const validation = batchAutoGradeSchema.safeParse(body);
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

  const { assignmentId, questionTypes, rubricOverride } = validation.data;

  try {
    // 1. Validate assignment exists
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (!assignment) {
      return c.json({ error: 'Assignment not found' }, 404);
    }

    // Verify staff is enrolled in the course as lecturer or TA
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.userId, user.id),
          eq(enrollments.courseId, assignment.courseId),
          inArray(enrollments.role, ['lecturer', 'ta'])
        )
      )
      .limit(1);

    if (!enrollment && user.role !== 'admin') {
      return c.json({ error: 'You do not have permission to auto-grade this assignment' }, 403);
    }

    // 2. Validate all questions have model answers
    const validation = await validateAssignmentHasAnswers(assignmentId);
    
    if (!validation.valid) {
      return c.json(
        {
          error: 'Some questions are missing model answers',
          missingAnswers: validation.missingAnswers,
        },
        400
      );
    }

    // 3. Get all questions in assignment
    const assignmentQs = await db
      .select({
        questionId: assignmentQuestions.questionId,
        type: questions.type,
      })
      .from(assignmentQuestions)
      .innerJoin(questions, eq(assignmentQuestions.questionId, questions.id))
      .where(eq(assignmentQuestions.assignmentId, assignmentId));

    // Filter by question types if specified
    const targetTypes = questionTypes || ['written', 'uml'];
    const questionIds = assignmentQs
      .filter((q) => targetTypes.includes(q.type as any))
      .map((q) => q.questionId);

    if (questionIds.length === 0) {
      return c.json({ error: 'No gradable questions found in assignment' }, 400);
    }

    // 4. Get all submitted/late submissions for this assignment
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
      return c.json({ error: 'No submitted assignments to grade' }, 400);
    }

    // 5. Get all answers for these submissions that haven't been auto-graded yet
    const submissionIds = submissionList.map((s) => s.id);
    
    const answersToGrade = await db
      .select({
        id: answers.id,
        questionId: answers.questionId,
        submissionId: answers.submissionId,
        userId: submissions.userId,
        questionType: questions.type,
      })
      .from(answers)
      .innerJoin(submissions, eq(answers.submissionId, submissions.id))
      .innerJoin(questions, eq(answers.questionId, questions.id))
      .where(
        and(
          inArray(answers.submissionId, submissionIds),
          inArray(answers.questionId, questionIds),
          isNull(answers.aiGradingSuggestion) // Only grade answers without existing AI suggestion
        )
      );

    if (answersToGrade.length === 0) {
      return c.json({ message: 'All answers already auto-graded', queuedCount: 0 }, 200);
    }

    // 6. Generate batch ID
    const batchId = randomUUID();

    // 7. Queue jobs for each answer
    let queuedCount = 0;

    for (const answer of answersToGrade) {
      const taskName = answer.questionType === 'written' ? 'auto-grade-written' : 'auto-grade-uml';
      
      // Create job record first to get job ID
      const [jobRecord] = await db
        .insert(aiGradingJobs)
        .values({
          batchId,
          answerId: answer.id,
          status: 'pending',
          tokensUsed: 0,
          cost: '0',
        })
        .returning();

      // Queue job with Graphile Worker
      await addJob(taskName, {
        answerId: answer.id,
        questionId: answer.questionId,
        submissionId: answer.submissionId,
        userId: answer.userId,
        batchId,
        jobId: jobRecord.id,
        rubricOverride: rubricOverride || undefined, // Pass optional rubric override
      });

      queuedCount++;
    }

    // 8. Estimate cost (rough estimate: 1000 tokens per grading @ $0.01 per 1k tokens)
    const estimatedTokens = queuedCount * 1000;
    const estimatedCost = (estimatedTokens / 1_000_000) * 10; // Assuming $10/1M tokens average

    return c.json({
      success: true,
      batchId,
      queuedCount,
      estimatedTokens,
      estimatedCost: parseFloat(estimatedCost.toFixed(4)),
      message: `Queued ${queuedCount} answers for auto-grading`,
    });

  } catch (error: any) {
    console.error('Batch auto-grade error:', error);
    return c.json({ error: 'Failed to queue auto-grading jobs', details: error.message }, 500);
  }
});

/**
 * GET /api/auto-grade/queue
 * 
 * Get current job queue status and statistics
 */
app.get('/queue', authMiddleware, async (c) => {
  const user = c.get('user');
  
  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  try {
    // Count jobs by status
    const jobs = await db.select().from(aiGradingJobs);

    const pending = jobs.filter((j) => j.status === 'pending').length;
    const processing = jobs.filter((j) => j.status === 'processing').length;
    const completed = jobs.filter((j) => j.status === 'completed').length;
    const failed = jobs.filter((j) => j.status === 'failed').length;

    // Since we don't have processingTimeMs in schema, estimate based on stats table
    const stats = await db.select().from(aiUsageStats).limit(1);
    const avgProcessingTime = stats.length > 0 && stats[0].avgProcessingTime ? stats[0].avgProcessingTime : 5000;

    // Estimated completion time (pending jobs × avg time)
    const estimatedCompletionMs = pending * avgProcessingTime;

    return c.json({
      pending,
      processing,
      completed,
      failed,
      total: jobs.length,
      avgProcessingTimeMs: avgProcessingTime,
      estimatedCompletionMs,
      queueDepth: pending + processing,
    });

  } catch (error: any) {
    console.error('Queue status error:', error);
    return c.json({ error: 'Failed to fetch queue status' }, 500);
  }
});

/**
 * GET /api/auto-grade/stats
 * 
 * Get usage statistics and cost analytics
 */
app.get('/stats', authMiddleware, async (c) => {
  const user = c.get('user');
  
  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const period = c.req.query('period') || 'week'; // week | month | all

  try {
    const today = new Date();
    let startDate: Date;

    if (period === 'week') {
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 1);
    } else {
      startDate = new Date('1970-01-01'); // All time
    }

    // Get stats from database
    const stats = await db.select().from(aiUsageStats);

    // Filter by date range
    const filteredStats = stats.filter((s) => s.date >= startDate);

    // Aggregate totals
    const totalTokens = filteredStats.reduce((sum, s) => sum + s.totalTokens, 0);
    const totalCost = filteredStats.reduce((sum, s) => sum + parseFloat(s.totalCost), 0);
    const totalRequests = filteredStats.reduce((sum, s) => sum + s.requestCount, 0);
    const totalSuccess = filteredStats.reduce((sum, s) => sum + s.successCount, 0);
    const totalFailures = filteredStats.reduce((sum, s) => sum + s.failureCount, 0);

    // Success rate
    const successRate = totalRequests > 0 ? (totalSuccess / totalRequests) * 100 : 0;

    // Provider breakdown
    const providerBreakdown = filteredStats.reduce((acc, s) => {
      const key = s.provider;
      if (!acc[key]) {
        acc[key] = { tokens: 0, cost: 0, count: 0 };
      }
      acc[key].tokens += s.totalTokens;
      acc[key].cost += parseFloat(s.totalCost);
      acc[key].count += s.requestCount;
      return acc;
    }, {} as Record<string, { tokens: number; cost: number; count: number }>);

    // Convert to array for easier consumption
    const providerBreakdownArray = Object.entries(providerBreakdown).map(([provider, data]) => ({
      provider,
      tokens: data.tokens,
      cost: parseFloat(data.cost.toFixed(6)),
      count: data.count,
    }));

    // Average processing time (weighted average across all stats)
    const totalProcessingTime = filteredStats.reduce((sum, s) => {
      return sum + (s.avgProcessingTime || 0) * s.requestCount;
    }, 0);
    const avgProcessingTime = totalRequests > 0 ? Math.round(totalProcessingTime / totalRequests) : null;

    // Average cost per request
    const avgCostPerRequest = totalRequests > 0 ? totalCost / totalRequests : 0;

    return c.json({
      period,
      totalTokens,
      totalCost: parseFloat(totalCost.toFixed(6)),
      totalRequests,
      successCount: totalSuccess,
      failureCount: totalFailures,
      successRate: parseFloat(successRate.toFixed(2)),
      avgCostPerRequest: parseFloat(avgCostPerRequest.toFixed(6)),
      avgProcessingTime,
      providerBreakdown: providerBreakdownArray,
      dailyStats: filteredStats.map((s) => ({
        date: s.date.toISOString().split('T')[0],
        tokens: s.totalTokens,
        cost: parseFloat(parseFloat(s.totalCost).toFixed(6)),
        requests: s.requestCount,
        successRate: s.requestCount > 0 ? (s.successCount / s.requestCount) * 100 : 0,
      })),
    });

  } catch (error: any) {
    console.error('Stats error:', error);
    return c.json({ error: 'Failed to fetch statistics' }, 500);
  }
});

/**
 * POST /api/auto-grade/single
 * 
 * Trigger auto-grading for a single answer.
 * Useful for re-grading or grading with custom rubric.
 */
app.post('/single', authMiddleware, async (c) => {
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

/**
 * POST /api/auto-grade/:answerId/accept
 * 
 * Accept AI grading suggestion and create official mark.
 */
app.post('/:answerId/accept', authMiddleware, async (c) => {
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

/**
 * POST /api/auto-grade/:answerId/reject
 * 
 * Reject AI suggestion and provide manual grade.
 */
app.post('/:answerId/reject', authMiddleware, async (c) => {
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

/**
 * GET /api/auto-grade/assignments
 * 
 * List all published assignments with auto-grading metadata.
 * Supports filtering by course and grading status.
 */
app.get('/assignments', authMiddleware, async (c) => {
  const user = c.get('user');
  
  // Only staff/admin can view auto-grading dashboard
  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    return c.json(errorResponse('Unauthorized', undefined, ErrorCodes.UNAUTHORIZED), 403);
  }

  const courseId = c.req.query('courseId');
  const status = c.req.query('status'); // 'all' | 'pending' | 'complete'

  try {
    // Get all published assignments with course info
    const allAssignments = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        courseId: assignments.courseId,
        dueDate: assignments.dueDate,
        isPublished: assignments.isPublished,
      })
      .from(assignments)
      .where(eq(assignments.isPublished, true))
      .orderBy(assignments.dueDate);

    // Filter by courseId if provided
    const filteredAssignments = courseId
      ? allAssignments.filter(a => a.courseId === courseId)
      : allAssignments;

    // For each assignment, get detailed grading metadata
    const assignmentData = await Promise.all(
      filteredAssignments.map(async (assignment) => {
        // Get course info
        const [course] = await db
          .select({
            id: courses.id,
            code: courses.code,
            name: courses.name,
          })
          .from(courses)
          .where(eq(courses.id, assignment.courseId));

        // Get all questions for this assignment
        const assignmentQs = await db
          .select({
            questionId: assignmentQuestions.questionId,
            type: questions.type,
            content: questions.content,
          })
          .from(assignmentQuestions)
          .innerJoin(questions, eq(assignmentQuestions.questionId, questions.id))
          .where(eq(assignmentQuestions.assignmentId, assignment.id));

        const totalQuestions = assignmentQs.length;
        const gradableQuestions = assignmentQs.filter(
          q => q.type === 'written' || q.type === 'uml'
        );
        const gradableCount = gradableQuestions.length;

        // Find questions missing model answers (stored in content.modelAnswer)
        const missingModelAnswers = gradableQuestions
          .filter(q => {
            const content = q.content as any;
            return !content?.modelAnswer;
          })
          .map(q => q.questionId);

        // Get submitted/late submissions for this assignment
        const submissionList = await db
          .select({ id: submissions.id })
          .from(submissions)
          .where(
            and(
              eq(submissions.assignmentId, assignment.id),
              inArray(submissions.status, ['submitted', 'late'])
            )
          );

        const totalSubmissions = submissionList.length;

        // Count ungraded answers (written/UML only, no aiGradingSuggestion)
        let ungradedCount = 0;
        if (gradableCount > 0 && totalSubmissions > 0) {
          const ungradedAnswers = await db
            .select({ id: answers.id })
            .from(answers)
            .innerJoin(questions, eq(answers.questionId, questions.id))
            .where(
              and(
                inArray(answers.submissionId, submissionList.map(s => s.id)),
                inArray(questions.type, ['written', 'uml']),
                isNull(answers.aiGradingSuggestion)
              )
            );
          ungradedCount = ungradedAnswers.length;
        }

        return {
          id: assignment.id,
          title: assignment.title,
          courseId: assignment.courseId,
          courseName: course?.name || 'Unknown',
          courseCode: course?.code || 'N/A',
          dueDate: assignment.dueDate,
          totalQuestions,
          gradableQuestions: gradableCount,
          totalSubmissions,
          ungradedAnswers: ungradedCount,
          missingModelAnswers,
          canAutoGrade: missingModelAnswers.length === 0 && gradableCount > 0,
        };
      })
    );

    // Filter by status if provided
    let result = assignmentData;
    if (status === 'pending') {
      result = assignmentData.filter(a => a.ungradedAnswers > 0);
    } else if (status === 'complete') {
      result = assignmentData.filter(a => a.ungradedAnswers === 0);
    }

    return c.json({ assignments: result });

  } catch (error: any) {
    console.error('Get assignments error:', error);
    return c.json({ error: 'Failed to fetch assignments', details: error.message }, 500);
  }
});

export default app;
