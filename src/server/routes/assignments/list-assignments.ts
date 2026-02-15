import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { assignments, enrollments, submissions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, and, desc, inArray } from 'drizzle-orm';

const listAssignmentsRoute = new Hono<AuthContext>();

// Get assignments for a course
listAssignmentsRoute.get('/course/:courseId', requireAuth, async (c) => {
  const courseId = c.req.param('courseId');
  const user = c.get('user')!;

  // Check enrollment
  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, user.id),
        eq(enrollments.courseId, courseId)
      )
    )
    .limit(1);

  if (!enrollment && user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Not enrolled in this course' }, 403);
  }

  // Students only see published assignments
  const assignmentsList = await db
    .select()
    .from(assignments)
    .where(
      user.role === 'student'
        ? and(
            eq(assignments.courseId, courseId),
            eq(assignments.isPublished, true)
          )
        : eq(assignments.courseId, courseId)
    )
    .orderBy(desc(assignments.createdAt));

  // For students, include submission status
  if (user.role === 'student') {
    const assignmentIds = assignmentsList.map((a) => a.id);
    const userSubmissions = await db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.userId, user.id),
          inArray(submissions.assignmentId, assignmentIds)
        )
      );

    const submissionsByAssignment = new Map(
      userSubmissions.map((s) => [s.assignmentId, s])
    );

    const assignmentsWithStatus = assignmentsList.map((assignment) => ({
      ...assignment,
      submissionStatus: submissionsByAssignment.get(assignment.id)?.status || null,
    }));

    return c.json(assignmentsWithStatus);
  }

  return c.json(assignmentsList);
});

export default listAssignmentsRoute;
