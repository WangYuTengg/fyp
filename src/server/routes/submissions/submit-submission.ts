import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { answers, assignmentQuestions, assignments, marks, questions, submissions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { and, eq, inArray } from 'drizzle-orm';
import { applyLatePenalty, getEffectiveDueDate, type LatePenaltyConfig } from '../../lib/grading-utils.js';
import { gradeMcqAnswer } from '../../lib/mcq-grading.js';

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

  const submissionAnswers = await db
    .select({
      answerId: answers.id,
      answerContent: answers.content,
      questionType: questions.type,
      questionContent: questions.content,
      questionPoints: questions.points,
      assignmentQuestionPoints: assignmentQuestions.points,
    })
    .from(answers)
    .innerJoin(questions, eq(answers.questionId, questions.id))
    .innerJoin(
      assignmentQuestions,
      and(
        eq(assignmentQuestions.assignmentId, submission.assignmentId),
        eq(assignmentQuestions.questionId, questions.id)
      )
    )
    .where(eq(answers.submissionId, submissionId));

  for (const answer of submissionAnswers) {
    if (answer.questionType !== 'mcq') {
      continue;
    }

    const maxPoints = answer.assignmentQuestionPoints ?? answer.questionPoints;
    const penaltyPerWrongSelection =
      typeof assignment?.mcqPenaltyPerWrongSelection === 'number'
        ? assignment.mcqPenaltyPerWrongSelection
        : 1;
    const grade = gradeMcqAnswer(
      answer.questionContent,
      answer.answerContent,
      maxPoints,
      penaltyPerWrongSelection
    );

    const [existingMark] = await db
      .select()
      .from(marks)
      .where(
        and(
          eq(marks.submissionId, submissionId),
          eq(marks.answerId, answer.answerId)
        )
      )
      .limit(1);

    if (existingMark) {
      await db
        .update(marks)
        .set({
          points: grade.points,
          maxPoints,
          feedback: grade.feedback,
          markedBy: null,
          isAiAssisted: false,
          aiSuggestionAccepted: false,
          updatedAt: now,
        })
        .where(eq(marks.id, existingMark.id));
      continue;
    }

    await db.insert(marks).values({
      submissionId,
      answerId: answer.answerId,
      points: grade.points,
      maxPoints,
      feedback: grade.feedback,
      markedBy: null,
      isAiAssisted: false,
      aiSuggestionAccepted: false,
    });
  }

  const [nonMcqQuestion] = await db
    .select({ id: questions.id })
    .from(assignmentQuestions)
    .innerJoin(questions, eq(assignmentQuestions.questionId, questions.id))
    .where(
      and(
        eq(assignmentQuestions.assignmentId, submission.assignmentId),
        inArray(questions.type, ['written', 'uml', 'coding'])
      )
    )
    .limit(1);

  // Calculate late penalty if applicable
  let latePenaltyApplied: string | null = null;
  let latePenaltyDetails: Record<string, unknown> | null = null;

  if (status === 'late' && assignment) {
    const penaltyConfig: LatePenaltyConfig = {
      type: (assignment.latePenaltyType as LatePenaltyConfig['type']) ?? 'none',
      value: assignment.latePenaltyValue ? Number(assignment.latePenaltyValue) : 0,
      cap: assignment.latePenaltyCap ? Number(assignment.latePenaltyCap) : null,
    };

    if (penaltyConfig.type !== 'none') {
      const effectiveDueDate = getEffectiveDueDate(
        assignment.dueDate,
        submission.startedAt,
        assignment.timeLimit,
      );

      if (effectiveDueDate) {
        const penaltyResult = applyLatePenalty(100, now, effectiveDueDate, penaltyConfig);
        latePenaltyApplied = String(penaltyResult.penaltyPercent);
        latePenaltyDetails = {
          type: penaltyConfig.type,
          value: penaltyConfig.value,
          cap: penaltyConfig.cap,
          minutesLate: penaltyResult.minutesLate,
          penaltyPercent: penaltyResult.penaltyPercent,
        };
      }
    }
  }

  const shouldAutoCompleteGrading = !nonMcqQuestion;
  const [updated] = await db
    .update(submissions)
    .set({
      status: shouldAutoCompleteGrading ? 'graded' : status,
      submittedAt: now,
      gradedAt: shouldAutoCompleteGrading ? now : null,
      latePenaltyApplied,
      latePenaltyDetails,
      updatedAt: now,
    })
    .where(eq(submissions.id, submissionId))
    .returning();

  return c.json(updated);
});

export default submitSubmissionRoute;
