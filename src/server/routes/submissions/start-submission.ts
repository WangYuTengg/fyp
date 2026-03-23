import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { submissions, assignments, answers, enrollments, assignmentQuestions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, and, desc, count } from 'drizzle-orm';
import { startSubmissionSchema } from '../../lib/validation-schemas.js';
import { errorResponse, ErrorCodes } from '../../lib/errors.js';
import { deterministicShuffle } from './deterministic-shuffle.js';

async function generateQuestionOrder(assignmentId: string, submissionId: string): Promise<string[] | null> {
  // Fetch assignment to check if shuffling is enabled
  const [assignment] = await db
    .select({ shuffleQuestions: assignments.shuffleQuestions })
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (!assignment?.shuffleQuestions) {
    return null;
  }

  // Get question IDs in their default order
  const questionLinks = await db
    .select({ questionId: assignmentQuestions.questionId })
    .from(assignmentQuestions)
    .where(eq(assignmentQuestions.assignmentId, assignmentId))
    .orderBy(assignmentQuestions.order);

  const questionIds = questionLinks.map((q) => q.questionId);

  if (questionIds.length <= 1) {
    return null;
  }

  return deterministicShuffle(questionIds, submissionId);
}

const startSubmissionRoute = new Hono<AuthContext>();

// Start a new submission (creates draft)
startSubmissionRoute.post('/start', requireAuth, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json();

  // Validate request body
  const validation = startSubmissionSchema.safeParse(body);
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

  const { assignmentId } = validation.data;

  // Check enrollment
  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (!assignment) {
    return c.json({ error: 'Assignment not found' }, 404);
  }

  // Check if assignment is open
  if (assignment.openDate && new Date() < assignment.openDate) {
    return c.json({ error: 'Assignment not yet open' }, 403);
  }

  // Check for an existing draft — return it if still active, or auto-submit if expired
  const [existingDraft] = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.assignmentId, assignmentId),
        eq(submissions.userId, user.id),
        eq(submissions.status, 'draft')
      )
    )
    .orderBy(desc(submissions.createdAt))
    .limit(1);

  if (existingDraft) {
    // Check if the draft's timer has expired
    let draftExpired = false;
    if (assignment.timeLimit) {
      const startTime = new Date(existingDraft.startedAt).getTime();
      const endTime = startTime + assignment.timeLimit * 60 * 1000;
      draftExpired = Date.now() > endTime;
    }

    if (!draftExpired) {
      // Draft is still active — resume it
      const existingAnswers = await db
        .select()
        .from(answers)
        .where(eq(answers.submissionId, existingDraft.id));

      return c.json({ ...existingDraft, answers: existingAnswers });
    }

    // Draft has expired — auto-submit it so a new attempt can be created
    const now = new Date();
    let expiredStatus: 'submitted' | 'late' = 'submitted';
    if (assignment.dueDate && now > assignment.dueDate) {
      expiredStatus = 'late';
    }

    await db
      .update(submissions)
      .set({
        status: expiredStatus,
        submittedAt: now,
        autoSubmitted: true,
        updatedAt: now,
      })
      .where(eq(submissions.id, existingDraft.id));
  }

  // Admins can start a submission for UI inspection without enrollment.
  if (user.role === 'admin') {
    const [{ value: attemptCount }] = await db
      .select({ value: count() })
      .from(submissions)
      .where(
        and(
          eq(submissions.assignmentId, assignmentId),
          eq(submissions.userId, user.id)
        )
      );

    const [submission] = await db
      .insert(submissions)
      .values({
        assignmentId,
        userId: user.id,
        attemptNumber: attemptCount + 1,
        status: 'draft',
        startedAt: new Date(),
      })
      .returning();

    // Generate shuffled question order if enabled
    const questionOrder = await generateQuestionOrder(assignmentId, submission.id);
    if (questionOrder) {
      await db
        .update(submissions)
        .set({ questionOrder })
        .where(eq(submissions.id, submission.id));
      return c.json({ ...submission, questionOrder, answers: [] }, 201);
    }

    return c.json({ ...submission, answers: [] }, 201);
  }

  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, user.id),
        eq(enrollments.courseId, assignment.courseId)
      )
    )
    .limit(1);

  if (!enrollment) {
    return c.json({ error: 'Not enrolled in this course' }, 403);
  }

  // Check attempt limit
  const [{ value: attemptCount }] = await db
    .select({ value: count() })
    .from(submissions)
    .where(
      and(
        eq(submissions.assignmentId, assignmentId),
        eq(submissions.userId, user.id)
      )
    );

  if (assignment.maxAttempts && attemptCount >= assignment.maxAttempts) {
    return c.json({ error: 'Maximum attempts reached' }, 400);
  }

  const [submission] = await db
    .insert(submissions)
    .values({
      assignmentId,
      userId: user.id,
      attemptNumber: attemptCount + 1,
      status: 'draft',
      startedAt: new Date(),
    })
    .returning();

  // Generate shuffled question order if enabled
  const questionOrder = await generateQuestionOrder(assignmentId, submission.id);
  if (questionOrder) {
    await db
      .update(submissions)
      .set({ questionOrder })
      .where(eq(submissions.id, submission.id));
    return c.json({ ...submission, questionOrder, answers: [] }, 201);
  }

  return c.json({ ...submission, answers: [] }, 201);
});

export default startSubmissionRoute;
