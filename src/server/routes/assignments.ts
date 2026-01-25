import { Hono } from 'hono';
import { db } from '../../db/index.js';
import { assignments, assignmentQuestions, questions, enrollments } from '../../db/schema.js';
import { requireAuth, type AuthContext } from '../middleware/auth.js';
import { eq, and, desc, inArray } from 'drizzle-orm';

const app = new Hono<AuthContext>();

// Get assignments for a course
app.get('/course/:courseId', requireAuth, async (c) => {
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

  return c.json(assignmentsList);
});

// Get a single assignment
app.get('/:id', requireAuth, async (c) => {
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

  return c.json({ ...assignment, questions: assignmentQs });
});

// Create an assignment (staff/admin only)
app.post('/', requireAuth, async (c) => {
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const { courseId, title, description, type, dueDate, openDate, maxAttempts, timeLimit, questionIds } = body as {
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

  const allowedTypes = ['mcq', 'written'] as const;
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

// Publish/unpublish an assignment
app.patch('/:id/publish', requireAuth, async (c) => {
  const assignmentId = c.req.param('id');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const { isPublished } = body;

  const [updated] = await db
    .update(assignments)
    .set({ isPublished, updatedAt: new Date() })
    .where(eq(assignments.id, assignmentId))
    .returning();

  if (!updated) {
    return c.json({ error: 'Assignment not found' }, 404);
  }

  return c.json(updated);
});

// Delete an assignment (staff/admin only)
app.delete('/:id', requireAuth, async (c) => {
  const assignmentId = c.req.param('id');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const [deleted] = await db
    .delete(assignments)
    .where(eq(assignments.id, assignmentId))
    .returning();

  if (!deleted) {
    return c.json({ error: 'Assignment not found' }, 404);
  }

  return c.json({ success: true });
});

export default app;
