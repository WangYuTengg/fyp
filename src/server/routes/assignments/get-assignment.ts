import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { assignments, assignmentQuestions, questions, enrollments } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, and } from 'drizzle-orm';
import { omitTeacherOnlyFields, toStudentSafeMcqContent } from '../../lib/content-utils.js';

const getAssignmentRoute = new Hono<AuthContext>();

// Get a single assignment
getAssignmentRoute.get('/:id', requireAuth, async (c) => {
  const assignmentId = c.req.param('id');
  const user = c.get('user')!;

  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (!assignment) {
    return c.json({ error: 'Assignment not found' }, 404);
  }

  // Check access
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

  if (!enrollment && user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Not enrolled in this course' }, 403);
  }

  // Students can't see unpublished assignments
  if (user.role === 'student' && !assignment.isPublished) {
    return c.json({ error: 'Assignment not available' }, 404);
  }

  // Get questions
  const assignmentQs = await db
    .select({
      id: assignmentQuestions.id,
      order: assignmentQuestions.order,
      points: assignmentQuestions.points,
      question: questions,
    })
    .from(assignmentQuestions)
    .innerJoin(questions, eq(assignmentQuestions.questionId, questions.id))
    .where(eq(assignmentQuestions.assignmentId, assignmentId))
    .orderBy(assignmentQuestions.order);

  // Students should not receive model answers or correctness keys in the API payload.
  // (UI may not render them, but they would be visible in network/devtools.)
  const sanitizedQuestions = user.role === 'student'
    ? assignmentQs.map((row) => {
        const q = row.question;

        if (q.type === 'written' || q.type === 'uml') {
          return { ...row, question: { ...q, content: omitTeacherOnlyFields(q.content) } };
        }

        if (q.type === 'mcq') {
          return {
            ...row,
            question: {
              ...q,
              content: toStudentSafeMcqContent(q.content),
            },
          };
        }

        return row;
      })
    : assignmentQs;

  return c.json({ ...assignment, questions: sanitizedQuestions });
});

export default getAssignmentRoute;
