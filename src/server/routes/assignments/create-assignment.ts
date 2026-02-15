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
    type,
    dueDate,
    openDate,
    maxAttempts,
    timeLimit,
    questionIds,
  } = body as {
    courseId?: string;
    title?: string;
    description?: string;
    type?: string;
    dueDate?: string | null;
    openDate?: string | null;
    maxAttempts?: number | null;
    timeLimit?: number | null;
    questionIds?: string[];
  };

  if (!courseId || !title || !type) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const allowedTypes = ['mcq', 'written', 'uml'] as const;
  type AssignmentType = (typeof allowedTypes)[number];
  if (!allowedTypes.includes(type as AssignmentType)) {
    return c.json({ error: 'Invalid assignment type' }, 400);
  }

  const assignmentType = type as AssignmentType;
  const maxAttemptsValue = typeof maxAttempts === 'number' && maxAttempts > 0 ? maxAttempts : 1;

  // Validate due date is in the future
  if (dueDate) {
    const dueDateObj = new Date(dueDate);
    const now = new Date();
    if (dueDateObj <= now) {
      return c.json({ error: 'Due date must be in the future' }, 400);
    }
  }

  const [assignment] = await db
    .insert(assignments)
    .values({
      courseId,
      title,
      description,
      type: assignmentType,
      dueDate: dueDate ? new Date(dueDate) : null,
      openDate: openDate ? new Date(openDate) : new Date(),
      maxAttempts: maxAttemptsValue,
      timeLimit,
      isPublished: false,
      createdBy: user.id,
    })
    .returning();

  if (Array.isArray(questionIds) && questionIds.length > 0) {
    const questionRows = await db
      .select({ id: questions.id, type: questions.type, courseId: questions.courseId })
      .from(questions)
      .where(inArray(questions.id, questionIds));

    if (questionRows.length !== questionIds.length) {
      return c.json({ error: 'One or more questions were not found' }, 400);
    }

    const invalidQuestion = questionRows.find(
      (question) => question.type !== assignmentType || question.courseId !== courseId
    );

    if (invalidQuestion) {
      return c.json({ error: 'All questions must match the assignment type and course' }, 400);
    }

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
