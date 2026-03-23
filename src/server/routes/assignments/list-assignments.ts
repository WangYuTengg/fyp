import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { assignmentQuestions, assignments, enrollments, questions, submissions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, and, desc, inArray } from 'drizzle-orm';

const listAssignmentsRoute = new Hono<AuthContext>();

type QuestionType = 'mcq' | 'written' | 'coding' | 'uml';

function createEmptyQuestionTypeCounts() {
  return {
    mcq: 0,
    written: 0,
    uml: 0,
    coding: 0,
  };
}

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

  if (assignmentsList.length === 0) {
    return c.json([]);
  }

  const assignmentIds = assignmentsList.map((assignment) => assignment.id);
  const questionRows = await db
    .select({
      assignmentId: assignmentQuestions.assignmentId,
      type: questions.type,
    })
    .from(assignmentQuestions)
    .innerJoin(questions, eq(assignmentQuestions.questionId, questions.id))
    .where(inArray(assignmentQuestions.assignmentId, assignmentIds));

  const questionStatsByAssignment = new Map<string, {
    questionCount: number;
    questionTypeCounts: ReturnType<typeof createEmptyQuestionTypeCounts>;
  }>();

  for (const row of questionRows) {
    const stats = questionStatsByAssignment.get(row.assignmentId) ?? {
      questionCount: 0,
      questionTypeCounts: createEmptyQuestionTypeCounts(),
    };

    stats.questionCount += 1;
    stats.questionTypeCounts[row.type as QuestionType] += 1;
    questionStatsByAssignment.set(row.assignmentId, stats);
  }

  const getQuestionStats = (assignmentId: string) =>
    questionStatsByAssignment.get(assignmentId) ?? {
      questionCount: 0,
      questionTypeCounts: createEmptyQuestionTypeCounts(),
    };

  // For students, include submission status
  if (user.role === 'student') {
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
      ...getQuestionStats(assignment.id),
      submissionStatus: submissionsByAssignment.get(assignment.id)?.status || null,
      submissionId: submissionsByAssignment.get(assignment.id)?.id || null,
    }));

    return c.json(assignmentsWithStatus);
  }
  const submissionRows = await db
    .select({
      assignmentId: submissions.assignmentId,
    })
    .from(submissions)
    .where(inArray(submissions.assignmentId, assignmentIds));

  const attemptsByAssignment = new Map<string, number>();
  for (const row of submissionRows) {
    attemptsByAssignment.set(
      row.assignmentId,
      (attemptsByAssignment.get(row.assignmentId) ?? 0) + 1
    );
  }

  const assignmentsWithAttempts = assignmentsList.map((assignment) => ({
    ...assignment,
    ...getQuestionStats(assignment.id),
    attemptCount: attemptsByAssignment.get(assignment.id) ?? 0,
  }));

  return c.json(assignmentsWithAttempts);
});

export default listAssignmentsRoute;
