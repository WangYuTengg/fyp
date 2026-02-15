import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { submissions, assignments, answers, marks, questions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq } from 'drizzle-orm';
import { getSignedUrl } from '../../lib/storage.js';

const resultsRoute = new Hono<AuthContext>();

/**
 * GET /api/submissions/:submissionId/results
 * 
 * Get submission results with grades and feedback for student view.
 * Includes answers, marks, AI grading suggestions, and course/assignment info.
 */
resultsRoute.get('/:submissionId/results', requireAuth, async (c) => {
  const submissionId = c.req.param('submissionId');
  const user = c.get('user')!;

  // Fetch submission with assignment and course info
  const [submission] = await db
    .select({
      id: submissions.id,
      assignmentId: submissions.assignmentId,
      userId: submissions.userId,
      status: submissions.status,
      startedAt: submissions.startedAt,
      submittedAt: submissions.submittedAt,
      assignment: {
        id: assignments.id,
        title: assignments.title,
        courseId: assignments.courseId,
      },
    })
    .from(submissions)
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .where(eq(submissions.id, submissionId))
    .limit(1);

  if (!submission) {
    return c.json({ error: 'Submission not found' }, 404);
  }

  // Check authorization - must be submission owner or staff
  const isOwner = submission.userId === user.id;
  const isStaff = user.role === 'admin' || user.role === 'staff';

  if (!isOwner && !isStaff) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Fetch course info
  const { courses } = await import('../../../db/schema.js');
  const [course] = await db
    .select({
      id: courses.id,
      code: courses.code,
      name: courses.name,
    })
    .from(courses)
    .where(eq(courses.id, submission.assignment.courseId))
    .limit(1);

  // Fetch answers with questions and AI grading suggestions
  const submissionAnswers = await db
    .select({
      id: answers.id,
      questionId: answers.questionId,
      content: answers.content,
      fileUrl: answers.fileUrl,
      aiGradingSuggestion: answers.aiGradingSuggestion,
      question: {
        id: questions.id,
        title: questions.title,
        type: questions.type,
        content: questions.content,
        points: questions.points,
      },
    })
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .where(eq(answers.submissionId, submissionId));

  // Generate signed URLs and attach marks
  const submissionMarks = await db
    .select()
    .from(marks)
    .where(eq(marks.submissionId, submissionId));

  const marksByAnswerId = new Map(
    submissionMarks.map((m) => [m.answerId, m])
  );

  const answersWithDetails = await Promise.all(
    submissionAnswers.map(async (answer) => {
      let fileUrl = answer.fileUrl;
      if (fileUrl) {
        try {
          fileUrl = await getSignedUrl(fileUrl);
        } catch {
          // Keep original path if signed URL fails
        }
      }

      return {
        ...answer,
        fileUrl,
        mark: marksByAnswerId.get(answer.id) || null,
      };
    })
  );

  // Calculate totals
  const totalPoints = answersWithDetails.reduce((sum, a) => sum + a.question.points, 0);
  const earnedPoints = answersWithDetails.reduce((sum, a) => sum + (a.mark?.points || 0), 0);

  return c.json({
    ...submission,
    assignment: {
      ...submission.assignment,
      course: course || { id: submission.assignment.courseId, code: 'Unknown', name: 'Unknown' },
    },
    answers: answersWithDetails,
    totalPoints,
    earnedPoints,
  });
});

export default resultsRoute;
