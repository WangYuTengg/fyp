import { Hono } from 'hono';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import {
  assignments,
  submissions,
  answers,
  questions,
  assignmentQuestions,
  aiGradingJobs,
  enrollments,
} from '../../../db/schema.js';
import { authMiddleware, type AuthContext } from '../../middleware/auth.js';
import { validateAssignmentHasAnswers } from '../../lib/validators.js';
import { addJob } from '../../lib/worker.js';
import { randomUUID } from 'crypto';
import { batchAutoGradeSchema } from '../../lib/validation-schemas.js';
import { getErrorMessage } from '../../lib/error-utils.js';
import { errorResponse, ErrorCodes } from '../../lib/errors.js';

const batchRoute = new Hono<AuthContext>();

/**
 * POST /api/auto-grade/batch
 * 
 * Trigger batch auto-grading for an assignment.
 * Queues jobs for all ungraded written/UML questions.
 */
batchRoute.post('/batch', authMiddleware, async (c) => {
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
    const targetTypes = new Set(questionTypes ?? ['written', 'uml']);
    const questionIds = assignmentQs
      .filter((q) => targetTypes.has(q.type))
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
  } catch (error: unknown) {
    console.error('Batch auto-grade error:', error);
    return c.json({ error: 'Failed to queue auto-grading jobs', details: getErrorMessage(error) }, 500);
  }
});

export default batchRoute;
