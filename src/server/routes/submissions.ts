import { Hono } from 'hono';
import { db } from '../../db/index.js';
import { submissions, assignments, answers, marks, enrollments } from '../../db/schema.js';
import { requireAuth, type AuthContext } from '../middleware/auth.js';
import { eq, and, desc, count } from 'drizzle-orm';

const app = new Hono<AuthContext>();

// Get submissions for an assignment (students see only theirs, staff see all)
app.get('/assignment/:assignmentId', requireAuth, async (c) => {
  const assignmentId = c.req.param('assignmentId');
  const user = c.get('user')!;

  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (!assignment) {
    return c.json({ error: 'Assignment not found' }, 404);
  }

  if (user.role === 'student') {
    // Students see only their submissions
    const userSubmissions = await db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.assignmentId, assignmentId),
          eq(submissions.userId, user.id)
        )
      )
      .orderBy(desc(submissions.createdAt));

    return c.json(userSubmissions);
  } else {
    // Staff see all submissions
    const allSubmissions = await db
      .select()
      .from(submissions)
      .where(eq(submissions.assignmentId, assignmentId))
      .orderBy(desc(submissions.createdAt));

    return c.json(allSubmissions);
  }
});

// Start a new submission (creates draft)
app.post('/start', requireAuth, async (c) => {
  const user = c.get('user')!;
  const body = await c.req.json();
  const { assignmentId } = body;

  if (!assignmentId) {
    return c.json({ error: 'Assignment ID required' }, 400);
  }

  // Check enrollment
  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (!assignment) {
    return c.json({ error: 'Assignment not found' }, 404);
  }

  // Check for existing draft submission
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
    .limit(1);

  if (existingDraft) {
    // Load answers for the draft
    const existingAnswers = await db
      .select()
      .from(answers)
      .where(eq(answers.submissionId, existingDraft.id));

    return c.json({ ...existingDraft, answers: existingAnswers });
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

// Save answer to a submission
app.post('/:submissionId/answers', requireAuth, async (c) => {
  const submissionId = c.req.param('submissionId');
  const user = c.get('user')!;
  const body = await c.req.json();
  const { questionId, content, fileUrl } = body;

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

  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, submission.assignmentId))
    .limit(1);

  if (assignment?.dueDate) {
    const now = new Date();
    if (now > assignment.dueDate) {
      return c.json(
        { error: 'Assignment is past due. You can only submit your last saved answers.' },
        409
      );
    }
  }

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
  } else {
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
  }
});

// Submit an assignment (finalize)
app.post('/:submissionId/submit', requireAuth, async (c) => {
  const submissionId = c.req.param('submissionId');
  const user = c.get('user')!;

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
    return c.json({ error: 'Already submitted' }, 400);
  }

  const [updated] = await db
    .update(submissions)
    .set({
      status: 'submitted',
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, submissionId))
    .returning();

  return c.json(updated);
});

// Grade a submission (staff/admin only)
app.post('/:submissionId/grade', requireAuth, async (c) => {
  const submissionId = c.req.param('submissionId');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const { answerId, points, maxPoints, feedback } = body;

  if (points === undefined || maxPoints === undefined) {
    return c.json({ error: 'Points and maxPoints required' }, 400);
  }

  const [mark] = await db
    .insert(marks)
    .values({
      submissionId,
      answerId: answerId || null,
      points,
      maxPoints,
      feedback,
      markedBy: user.id,
      isAiAssisted: false,
    })
    .returning();

  // Update submission status
  await db
    .update(submissions)
    .set({
      status: 'graded',
      gradedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, submissionId));

  return c.json(mark, 201);
});

export default app;
