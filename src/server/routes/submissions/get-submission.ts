import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { submissions, answers, marks, questions, users, assignments } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, and, desc } from 'drizzle-orm';
import { omitTeacherOnlyFields, toStudentSafeMcqContent } from '../../lib/content-utils.js';
import { resolveScoringSubmission } from '../../lib/grading-utils.js';

const getSubmissionRoute = new Hono<AuthContext>();

// Get a single submission by ID with all details (answers, marks, user info)
getSubmissionRoute.get('/:submissionId', requireAuth, async (c) => {
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

  // Check authorization
  const isOwner = submission.userId === user.id;
  const isStaff = user.role === 'admin' || user.role === 'staff';

  if (!isOwner && !isStaff) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Load answers with question details
  const submissionAnswers = await db
    .select({
      id: answers.id,
      submissionId: answers.submissionId,
      questionId: answers.questionId,
      content: answers.content,
      createdAt: answers.createdAt,
      updatedAt: answers.updatedAt,
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

  // If a student is viewing their own submission, do not leak model answers / keys via question.content.
  const sanitizedAnswers = !isStaff
    ? submissionAnswers.map((answer) => {
        const q = answer.question;

        if (!q) return answer;

        if (q.type === 'written' || q.type === 'uml') {
          return { ...answer, question: { ...q, content: omitTeacherOnlyFields(q.content) } };
        }

        if (q.type === 'mcq') {
          return {
            ...answer,
            question: {
              ...q,
              content: toStudentSafeMcqContent(q.content),
            },
          };
        }

        return answer;
      })
    : submissionAnswers;

  // Load marks
  const submissionMarks = await db
    .select()
    .from(marks)
    .where(eq(marks.submissionId, submissionId));

  // Load user info if staff is viewing
  let userInfo = null;
  if (isStaff) {
    const [submitter] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.name,
      })
      .from(users)
      .where(eq(users.id, submission.userId))
      .limit(1);
    userInfo = submitter;
  }

  // Load all attempts for this student+assignment to determine scoring attempt
  const allAttempts = await db
    .select({
      id: submissions.id,
      attemptNumber: submissions.attemptNumber,
      status: submissions.status,
      startedAt: submissions.startedAt,
      submittedAt: submissions.submittedAt,
      gradedAt: submissions.gradedAt,
      autoSubmitted: submissions.autoSubmitted,
      latePenaltyApplied: submissions.latePenaltyApplied,
    })
    .from(submissions)
    .where(
      and(
        eq(submissions.assignmentId, submission.assignmentId),
        eq(submissions.userId, submission.userId)
      )
    )
    .orderBy(desc(submissions.attemptNumber));

  // Determine which attempt is the scoring attempt
  const [assignment] = await db
    .select({ attemptScoringMethod: assignments.attemptScoringMethod })
    .from(assignments)
    .where(eq(assignments.id, submission.assignmentId))
    .limit(1);

  const scoringMethod = (assignment?.attemptScoringMethod as 'latest' | 'highest') ?? 'latest';

  // For 'highest' method, we need total scores per attempt
  let scoringAttemptId = submission.id;
  if (allAttempts.length > 1) {
    if (scoringMethod === 'highest') {
      // Load marks for all attempts to compare total scores
      const attemptScores = await Promise.all(
        allAttempts.map(async (attempt) => {
          const attemptMarks = await db
            .select({ points: marks.points })
            .from(marks)
            .where(eq(marks.submissionId, attempt.id));
          const totalScore = attemptMarks.reduce((sum, m) => sum + m.points, 0);
          return { ...attempt, totalScore };
        })
      );
      const scoring = resolveScoringSubmission(attemptScores, 'highest');
      scoringAttemptId = scoring?.id ?? submission.id;
    } else {
      const scoring = resolveScoringSubmission(
        allAttempts.map((a) => ({ ...a, totalScore: 0 })),
        'latest',
      );
      scoringAttemptId = scoring?.id ?? submission.id;
    }
  }

  return c.json({
    ...submission,
    answers: sanitizedAnswers,
    marks: submissionMarks,
    user: userInfo,
    isScoringAttempt: submission.id === scoringAttemptId,
    scoringMethod,
    allAttempts,
  });
});

export default getSubmissionRoute;
