import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { answers, assignmentQuestions, assignments, marks, questions, submissions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { and, eq } from 'drizzle-orm';

type McqOption = {
  id?: string;
  isCorrect?: boolean;
};

function gradeMcqAnswer(
  questionContent: unknown,
  answerContent: unknown,
  maxPoints: number,
  penaltyPerWrongSelection: number
): { points: number; feedback: string } {
  const content = (questionContent ?? {}) as Record<string, unknown>;
  const options = Array.isArray(content.options) ? (content.options as McqOption[]) : [];
  const allowMultiple = content.allowMultiple === true;

  const correctOptionIds = new Set(
    options
      .filter((option) => option.isCorrect === true && typeof option.id === 'string')
      .map((option) => option.id as string)
  );

  const rawSelectedOptionIds =
    typeof answerContent === 'object' &&
    answerContent !== null &&
    Array.isArray((answerContent as Record<string, unknown>).selectedOptionIds)
      ? ((answerContent as Record<string, unknown>).selectedOptionIds as unknown[])
      : [];
  const selectedOptionIds = [...new Set(rawSelectedOptionIds.filter((id): id is string => typeof id === 'string'))];

  if (correctOptionIds.size === 0) {
    return { points: 0, feedback: 'Question has no configured correct options.' };
  }

  if (!allowMultiple) {
    const isCorrect = selectedOptionIds.length === 1 && correctOptionIds.has(selectedOptionIds[0]);
    return isCorrect
      ? { points: maxPoints, feedback: 'Correct answer.' }
      : { points: 0, feedback: 'Incorrect answer.' };
  }

  const selectedSet = new Set(selectedOptionIds);
  const wrongSelections = selectedOptionIds.filter((id) => !correctOptionIds.has(id));
  const hasAllCorrect = Array.from(correctOptionIds).every((id) => selectedSet.has(id));
  const isExactMatch = hasAllCorrect && wrongSelections.length === 0 && selectedOptionIds.length === correctOptionIds.size;

  if (isExactMatch) {
    return { points: maxPoints, feedback: 'Correct answer.' };
  }

  if (wrongSelections.length > 0) {
    const penaltyUnit = Number.isFinite(penaltyPerWrongSelection) && penaltyPerWrongSelection >= 0
      ? penaltyPerWrongSelection
      : 1;
    const penaltyPoints = wrongSelections.length * penaltyUnit;

    if (penaltyPoints <= 0) {
      return { points: 0, feedback: 'Incorrect answer.' };
    }

    return {
      points: -penaltyPoints,
      feedback: `Incorrect answer. ${penaltyPoints} penalty point${penaltyPoints === 1 ? '' : 's'} for wrong selection${wrongSelections.length === 1 ? '' : 's'}.`,
    };
  }

  return { points: 0, feedback: 'Incorrect answer.' };
}

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

  const shouldAutoCompleteGrading = assignment?.type === 'mcq';
  const [updated] = await db
    .update(submissions)
    .set({
      status: shouldAutoCompleteGrading ? 'graded' : status,
      submittedAt: now,
      gradedAt: shouldAutoCompleteGrading ? now : null,
      updatedAt: now,
    })
    .where(eq(submissions.id, submissionId))
    .returning();

  return c.json(updated);
});

export default submitSubmissionRoute;
