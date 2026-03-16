import { Hono } from 'hono';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import {
  assignments,
  submissions,
  answers,
  questions,
  assignmentQuestions,
  courses,
} from '../../../db/schema.js';
import { authMiddleware, type AuthContext } from '../../middleware/auth.js';
import { getQuestionContent } from '../../lib/content-utils.js';
import { getErrorMessage } from '../../lib/error-utils.js';
import { errorResponse, ErrorCodes } from '../../lib/errors.js';

const assignmentsRoute = new Hono<AuthContext>();

/**
 * GET /api/auto-grade/assignments
 * 
 * List all published assignments with auto-grading metadata.
 * Supports filtering by course and grading status.
 */
assignmentsRoute.get('/assignments', authMiddleware, async (c) => {
  const user = c.get('user');

  // Only staff/admin can view auto-grading dashboard
  if (!user || (user.role !== 'staff' && user.role !== 'admin')) {
    return c.json(errorResponse('Unauthorized', undefined, ErrorCodes.UNAUTHORIZED), 403);
  }

  const courseId = c.req.query('courseId');
  const status = c.req.query('status'); // 'all' | 'pending' | 'complete'

  try {
    // Get all published assignments with course info
    const allAssignments = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        courseId: assignments.courseId,
        dueDate: assignments.dueDate,
        isPublished: assignments.isPublished,
      })
      .from(assignments)
      .where(eq(assignments.isPublished, true))
      .orderBy(assignments.dueDate);

    // Filter by courseId if provided
    const filteredAssignments = courseId
      ? allAssignments.filter(a => a.courseId === courseId)
      : allAssignments;

    // For each assignment, get detailed grading metadata
    const assignmentData = await Promise.all(
      filteredAssignments.map(async (assignment) => {
        // Get course info
        const [course] = await db
          .select({
            id: courses.id,
            code: courses.code,
            name: courses.name,
          })
          .from(courses)
          .where(eq(courses.id, assignment.courseId));

        // Get all questions for this assignment
        const assignmentQs = await db
          .select({
            questionId: assignmentQuestions.questionId,
            type: questions.type,
            content: questions.content,
          })
          .from(assignmentQuestions)
          .innerJoin(questions, eq(assignmentQuestions.questionId, questions.id))
          .where(eq(assignmentQuestions.assignmentId, assignment.id));

        const totalQuestions = assignmentQs.length;
        const gradableQuestions = assignmentQs.filter(
          q => q.type === 'written' || q.type === 'uml'
        );
        const gradableCount = gradableQuestions.length;

        // Find questions missing model answers (stored in content.modelAnswer)
        const missingModelAnswers = gradableQuestions
          .filter((q) => !getQuestionContent(q.content).modelAnswer)
          .map(q => q.questionId);

        // Get submitted/late submissions for this assignment
        const submissionList = await db
          .select({ id: submissions.id })
          .from(submissions)
          .where(
            and(
              eq(submissions.assignmentId, assignment.id),
              inArray(submissions.status, ['submitted', 'late'])
            )
          );

        const totalSubmissions = submissionList.length;

        // Count ungraded answers (written/UML only, no aiGradingSuggestion)
        let ungradedCount = 0;
        if (gradableCount > 0 && totalSubmissions > 0) {
          const ungradedAnswers = await db
            .select({ id: answers.id })
            .from(answers)
            .innerJoin(questions, eq(answers.questionId, questions.id))
            .where(
              and(
                inArray(answers.submissionId, submissionList.map(s => s.id)),
                inArray(questions.type, ['written', 'uml']),
                isNull(answers.aiGradingSuggestion)
              )
            );
          ungradedCount = ungradedAnswers.length;
        }

        return {
          id: assignment.id,
          title: assignment.title,
          courseId: assignment.courseId,
          courseName: course?.name || 'Unknown',
          courseCode: course?.code || 'N/A',
          dueDate: assignment.dueDate,
          totalQuestions,
          gradableQuestions: gradableCount,
          totalSubmissions,
          ungradedAnswers: ungradedCount,
          missingModelAnswers,
          canAutoGrade: missingModelAnswers.length === 0 && gradableCount > 0,
        };
      })
    );

    // Filter by status if provided
    let result = assignmentData;
    if (status === 'pending') {
      result = assignmentData.filter(a => a.ungradedAnswers > 0);
    } else if (status === 'complete') {
      result = assignmentData.filter(a => a.ungradedAnswers === 0);
    }

    return c.json({ assignments: result });
  } catch (error: unknown) {
    console.error('Get assignments error:', error);
    return c.json({ error: 'Failed to fetch assignments', details: getErrorMessage(error) }, 500);
  }
});

export default assignmentsRoute;
