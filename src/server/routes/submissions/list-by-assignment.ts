import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { submissions, assignments, users } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, and, desc } from 'drizzle-orm';

const listByAssignmentRoute = new Hono<AuthContext>();

// Get submissions for an assignment (students see only theirs, staff see all)
listByAssignmentRoute.get('/assignment/:assignmentId', requireAuth, async (c) => {
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
  }

  // Staff see all submissions
  const allSubmissions = await db
    .select({
      id: submissions.id,
      assignmentId: submissions.assignmentId,
      userId: submissions.userId,
      attemptNumber: submissions.attemptNumber,
      status: submissions.status,
      startedAt: submissions.startedAt,
      submittedAt: submissions.submittedAt,
      gradedAt: submissions.gradedAt,
      createdAt: submissions.createdAt,
      updatedAt: submissions.updatedAt,
      user: {
        id: users.id,
        email: users.email,
        fullName: users.name,
      },
    })
    .from(submissions)
    .innerJoin(users, eq(submissions.userId, users.id))
    .where(eq(submissions.assignmentId, assignmentId))
    .orderBy(desc(submissions.createdAt));

  return c.json(allSubmissions);
});

export default listByAssignmentRoute;
