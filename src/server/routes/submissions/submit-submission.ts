import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { submissions, assignments } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';

const submitSubmissionRoute = new Hono<AuthContext>();

// Submit an assignment (finalize)
submitSubmissionRoute.post('/:submissionId/submit', requireAuth, async (c) => {
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

  // Determine if submission is late
  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, submission.assignmentId))
    .limit(1);

  const now = new Date();
  let status: 'submitted' | 'late' = 'submitted';

  // Check time limit
  if (assignment?.timeLimit) {
    const startTime = new Date(submission.startedAt).getTime();
    const endTime = startTime + assignment.timeLimit * 60 * 1000;

    if (now.getTime() > endTime) {
      status = 'late';
    }
  }

  // Check due date
  if (assignment?.dueDate && now > assignment.dueDate) {
    status = 'late';
  }

  const [updated] = await db
    .update(submissions)
    .set({
      status,
      submittedAt: now,
      updatedAt: now,
    })
    .where(eq(submissions.id, submissionId))
    .returning();

  return c.json(updated);
});

export default submitSubmissionRoute;
