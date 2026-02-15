import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { submissions, assignments, answers, enrollments } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, and, desc, count } from 'drizzle-orm';
import { startSubmissionSchema } from '../../lib/validation-schemas.js';
import { errorResponse, ErrorCodes } from '../../lib/errors.js';

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

  // Check for any existing submission (draft or submitted)
  const [existingSubmission] = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.assignmentId, assignmentId),
        eq(submissions.userId, user.id)
      )
    )
    .orderBy(desc(submissions.createdAt))
    .limit(1);

  if (existingSubmission) {
    // Load answers for the submission
    const existingAnswers = await db
      .select()
      .from(answers)
      .where(eq(answers.submissionId, existingSubmission.id));

    return c.json({ ...existingSubmission, answers: existingAnswers });
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

  return c.json({ ...submission, answers: [] }, 201);
});

export default startSubmissionRoute;
