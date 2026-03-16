import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { assignments, assignmentQuestions, questions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { inArray } from 'drizzle-orm';

const createAssignmentRoute = new Hono<AuthContext>();

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
    questionIds?: string[];
  };

  if (!courseId || !title) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const maxAttemptsValue = typeof maxAttempts === 'number' && maxAttempts > 0 ? maxAttempts : 1;
  let mcqPenaltyValue = 1;

  if (mcqPenaltyPerWrongSelection !== undefined && mcqPenaltyPerWrongSelection !== null) {
    if (!Number.isInteger(mcqPenaltyPerWrongSelection) || mcqPenaltyPerWrongSelection < 0) {
      return c.json({ error: 'mcqPenaltyPerWrongSelection must be an integer >= 0' }, 400);
    }
    mcqPenaltyValue = mcqPenaltyPerWrongSelection;
  }

  // Validate due date is in the future
  if (dueDate) {
    const dueDateObj = new Date(dueDate);
    const now = new Date();
    if (dueDateObj <= now) {
      return c.json({ error: 'Due date must be in the future' }, 400);
    }
  }

  if (Array.isArray(questionIds) && questionIds.length > 0) {
    const questionRows = await db
      .select({ id: questions.id, courseId: questions.courseId })
      .from(questions)
      .where(inArray(questions.id, questionIds));

    if (questionRows.length !== questionIds.length) {
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
      title,
      description,
      dueDate: dueDate ? new Date(dueDate) : null,
      openDate: openDate ? new Date(openDate) : new Date(),
      maxAttempts: maxAttemptsValue,
      mcqPenaltyPerWrongSelection: mcqPenaltyValue,
      timeLimit,
      isPublished: false,
      createdBy: user.id,
    })
    .returning();

  if (Array.isArray(questionIds) && questionIds.length > 0) {
    await db.insert(assignmentQuestions).values(
      questionIds.map((questionId, index) => ({
        assignmentId: assignment.id,
        questionId,
        order: index + 1,
      }))
    );
  }

  return c.json(assignment, 201);
});

export default createAssignmentRoute;
