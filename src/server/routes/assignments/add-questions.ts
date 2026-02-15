import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { assignments, assignmentQuestions, questions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, inArray } from 'drizzle-orm';

const addQuestionsRoute = new Hono<AuthContext>();

// Add questions to an assignment (staff/admin only)
addQuestionsRoute.post('/:id/questions', requireAuth, async (c) => {
  const assignmentId = c.req.param('id');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json();
  const { questionIds } = body as { questionIds?: string[] };

  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    return c.json({ error: 'questionIds array required' }, 400);
  }

  // Get the assignment
  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (!assignment) {
    return c.json({ error: 'Assignment not found' }, 404);
  }

  // Validate questions exist, match type, and belong to the same course
  const questionRows = await db
    .select({ id: questions.id, type: questions.type, courseId: questions.courseId })
    .from(questions)
    .where(inArray(questions.id, questionIds));

  if (questionRows.length !== questionIds.length) {
    return c.json({ error: 'One or more questions were not found' }, 400);
  }

  const invalidQuestion = questionRows.find(
    (question) => question.type !== assignment.type || question.courseId !== assignment.courseId
  );

  if (invalidQuestion) {
    return c.json({ error: 'All questions must match the assignment type and course' }, 400);
  }

  // Get current max order
  const existingQuestions = await db
    .select()
    .from(assignmentQuestions)
    .where(eq(assignmentQuestions.assignmentId, assignmentId));

  const maxOrder = existingQuestions.length > 0
    ? Math.max(...existingQuestions.map((q) => q.order))
    : 0;

  // Insert new questions (skip duplicates due to unique constraint)
  const newQuestions = await db
    .insert(assignmentQuestions)
    .values(
      questionIds.map((questionId, index) => ({
        assignmentId,
        questionId,
        order: maxOrder + index + 1,
      }))
    )
    .onConflictDoNothing()
    .returning();

  return c.json(newQuestions, 201);
});

export default addQuestionsRoute;
