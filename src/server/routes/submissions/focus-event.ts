import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { assignments, submissions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, sql } from 'drizzle-orm';

type TabSwitchEvent = {
  leftAt: string;
  returnedAt: string;
  durationMs: number;
};

const focusEventRoute = new Hono<AuthContext>();

focusEventRoute.post('/:submissionId/focus-event', requireAuth, async (c) => {
  const submissionId = c.req.param('submissionId');
  const user = c.get('user')!;

  const body = await c.req.json();
  const { leftAt, returnedAt, durationMs } = body as {
    leftAt?: string;
    returnedAt?: string;
    durationMs?: number;
  };

  if (!leftAt || !returnedAt || typeof durationMs !== 'number') {
    return c.json({ error: 'Missing required fields: leftAt, returnedAt, durationMs' }, 400);
  }

  if (durationMs < 0) {
    return c.json({ error: 'durationMs must be non-negative' }, 400);
  }

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
    return c.json({ error: 'Submission already finalized' }, 400);
  }

  // Check if focus monitoring is enabled for this assignment
  const [assignment] = await db
    .select({ monitorFocus: assignments.monitorFocus, maxTabSwitches: assignments.maxTabSwitches })
    .from(assignments)
    .where(eq(assignments.id, submission.assignmentId))
    .limit(1);

  if (!assignment?.monitorFocus) {
    return c.json({ error: 'Focus monitoring is not enabled for this assignment' }, 400);
  }

  const event: TabSwitchEvent = { leftAt, returnedAt, durationMs };

  // Append the event to the tabSwitches JSONB array
  const [updated] = await db
    .update(submissions)
    .set({
      tabSwitches: sql`${submissions.tabSwitches} || ${JSON.stringify([event])}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, submissionId))
    .returning({ tabSwitches: submissions.tabSwitches });

  const currentSwitchCount = Array.isArray(updated?.tabSwitches) ? updated.tabSwitches.length : 0;
  const shouldAutoSubmit =
    assignment.maxTabSwitches !== null &&
    assignment.maxTabSwitches > 0 &&
    currentSwitchCount >= assignment.maxTabSwitches;

  return c.json({
    success: true,
    data: {
      tabSwitchCount: currentSwitchCount,
      maxTabSwitches: assignment.maxTabSwitches,
      shouldAutoSubmit,
    },
  });
});

export default focusEventRoute;
