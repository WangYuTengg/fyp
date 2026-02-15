import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { submissions, answers, assignments, assignmentQuestions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, and } from 'drizzle-orm';
import { saveAnswerSchema } from '../../lib/validation-schemas.js';
import { errorResponse, ErrorCodes } from '../../lib/errors.js';

const saveAnswerRoute = new Hono<AuthContext>();

// Save answer to a submission
saveAnswerRoute.post('/:submissionId/answers', requireAuth, async (c) => {
  const submissionId = c.req.param('submissionId');
  const user = c.get('user')!;
  const body = await c.req.json();

  // Validate request body
  const validation = saveAnswerSchema.safeParse(body);
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

  const { questionId, content, fileUrl } = validation.data;

  // Verify ownership
  const [submission] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);

  if (!submission) {
    return c.json({ error: 'Submission not found' }, 404);
  }

  if (submission.userId !== user.id) {
    return c.json({ error: 'Not your submission' }, 403);
  }

  if (submission.status !== 'draft') {
    return c.json({ error: 'Cannot modify submitted assignment' }, 400);
  }

  // Validate that questionId belongs to this assignment
  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, submission.assignmentId))
    .limit(1);

  if (!assignment) {
    return c.json({ error: 'Assignment not found' }, 404);
  }

  const [assignmentQuestion] = await db
    .select()
    .from(assignmentQuestions)
    .where(
      and(
        eq(assignmentQuestions.assignmentId, submission.assignmentId),
        eq(assignmentQuestions.questionId, questionId)
      )
    )
    .limit(1);

  if (!assignmentQuestion) {
    return c.json({ error: 'Question does not belong to this assignment' }, 400);
  }

  // Check if assignment is open (prevent saves before open date)
  if (assignment.openDate && new Date() < assignment.openDate) {
    return c.json({ error: 'Assignment is not yet open' }, 403);
  }

  // Allow saves after due date (will be marked late on submit)

  // Upsert answer
  const [existingAnswer] = await db
    .select()
    .from(answers)
    .where(
      and(
        eq(answers.submissionId, submissionId),
        eq(answers.questionId, questionId)
      )
    )
    .limit(1);

  if (existingAnswer) {
    const [updated] = await db
      .update(answers)
      .set({ content, fileUrl, updatedAt: new Date() })
      .where(eq(answers.id, existingAnswer.id))
      .returning();

    return c.json(updated);
  }

  const [answer] = await db
    .insert(answers)
    .values({
      submissionId,
      questionId,
      content,
      fileUrl,
    })
    .returning();

  return c.json(answer, 201);
});

export default saveAnswerRoute;
