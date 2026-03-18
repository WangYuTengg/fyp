import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { assignments, assignmentQuestions, questions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { inArray } from 'drizzle-orm';

const createAssignmentRoute = new Hono<AuthContext>();

function parseOptionalDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'invalid' : parsed;
}

// Create an assignment (staff/admin only)
createAssignmentRoute.post('/', requireAuth, async (c) => {
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const {
    courseId,
    title,
    description,
    dueDate,
    openDate,
    maxAttempts,
    mcqPenaltyPerWrongSelection,
    timeLimit,
    monitorFocus,
    maxTabSwitches,
    questionIds,
  } = body as {
    courseId?: string;
    title?: string;
    description?: string;
    dueDate?: string | null;
    openDate?: string | null;
    maxAttempts?: number | null;
    mcqPenaltyPerWrongSelection?: number | null;
    timeLimit?: number | null;
    monitorFocus?: boolean;
    maxTabSwitches?: number | null;
    questionIds?: string[];
  };

  const trimmedTitle = title?.trim();
  const normalizedQuestionIds = Array.isArray(questionIds)
    ? questionIds.filter((questionId, index) => questionIds.indexOf(questionId) === index)
    : [];

  if (!courseId || !trimmedTitle) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  if (maxAttempts !== undefined && maxAttempts !== null && (!Number.isInteger(maxAttempts) || maxAttempts < 1)) {
    return c.json({ error: 'maxAttempts must be an integer >= 1' }, 400);
  }

  const maxAttemptsValue = typeof maxAttempts === 'number' ? maxAttempts : 1;
  let mcqPenaltyValue = 1;

  if (mcqPenaltyPerWrongSelection !== undefined && mcqPenaltyPerWrongSelection !== null) {
    if (!Number.isInteger(mcqPenaltyPerWrongSelection) || mcqPenaltyPerWrongSelection < 0) {
      return c.json({ error: 'mcqPenaltyPerWrongSelection must be an integer >= 0' }, 400);
    }
    mcqPenaltyValue = mcqPenaltyPerWrongSelection;
  }

  if (timeLimit !== undefined && timeLimit !== null && (!Number.isInteger(timeLimit) || timeLimit < 1)) {
    return c.json({ error: 'timeLimit must be an integer >= 1' }, 400);
  }

  if (maxTabSwitches !== undefined && maxTabSwitches !== null && (!Number.isInteger(maxTabSwitches) || maxTabSwitches < 1)) {
    return c.json({ error: 'maxTabSwitches must be an integer >= 1' }, 400);
  }

  const dueDateValue = parseOptionalDate(dueDate);
  const openDateValue = parseOptionalDate(openDate);

  if (dueDateValue === 'invalid') {
    return c.json({ error: 'Invalid dueDate' }, 400);
  }

  if (openDateValue === 'invalid') {
    return c.json({ error: 'Invalid openDate' }, 400);
  }

  // Validate due date is in the future
  if (dueDateValue) {
    const now = new Date();
    if (dueDateValue <= now) {
      return c.json({ error: 'Due date must be in the future' }, 400);
    }
  }

  if (dueDateValue && openDateValue && openDateValue >= dueDateValue) {
    return c.json({ error: 'openDate must be earlier than dueDate' }, 400);
  }

  if (normalizedQuestionIds.length > 0) {
    const questionRows = await db
      .select({ id: questions.id, courseId: questions.courseId })
      .from(questions)
      .where(inArray(questions.id, normalizedQuestionIds));

    if (questionRows.length !== normalizedQuestionIds.length) {
      return c.json({ error: 'One or more questions were not found' }, 400);
    }

    const invalidQuestion = questionRows.find((question) => question.courseId !== courseId);

    if (invalidQuestion) {
      return c.json({ error: 'All questions must belong to this course' }, 400);
    }
  }

  const [assignment] = await db
    .insert(assignments)
    .values({
      courseId,
      title: trimmedTitle,
      description: description?.trim() || null,
      dueDate: dueDateValue,
      openDate: openDateValue ?? new Date(),
      maxAttempts: maxAttemptsValue,
      mcqPenaltyPerWrongSelection: mcqPenaltyValue,
      timeLimit: timeLimit ?? null,
      monitorFocus: monitorFocus === true,
      maxTabSwitches: maxTabSwitches ?? null,
      isPublished: false,
      createdBy: user.id,
    })
    .returning();

  if (normalizedQuestionIds.length > 0) {
    await db.insert(assignmentQuestions).values(
      normalizedQuestionIds.map((questionId, index) => ({
        assignmentId: assignment.id,
        questionId,
        order: index + 1,
      }))
    );
  }

  return c.json(assignment, 201);
});

export default createAssignmentRoute;
