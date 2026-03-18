import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { assignments, assignmentQuestions, rubrics, questions } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, inArray } from 'drizzle-orm';

const cloneAssignmentRoute = new Hono<AuthContext>();

function parseOptionalDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Clone an assignment (staff/admin only)
cloneAssignmentRoute.post('/:id/clone', requireAuth, async (c) => {
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const sourceId = c.req.param('id');
  const body = await c.req.json();
  const { targetCourseId, newTitle, newDueDate } = body as {
    targetCourseId?: string;
    newTitle?: string;
    newDueDate?: string | null;
  };

  // Fetch source assignment
  const [source] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, sourceId))
    .limit(1);

  if (!source) {
    return c.json({ error: 'Assignment not found' }, 404);
  }

  const courseId = targetCourseId || source.courseId;

  // Fetch source assignment questions
  const sourceQuestions = await db
    .select()
    .from(assignmentQuestions)
    .where(eq(assignmentQuestions.assignmentId, sourceId))
    .orderBy(assignmentQuestions.order);

  // If cloning to a different course, verify all questions exist in the target course
  // or copy them over
  let questionIdMapping = new Map<string, string>(); // sourceQuestionId -> targetQuestionId

  if (courseId !== source.courseId && sourceQuestions.length > 0) {
    const sourceQuestionIds = sourceQuestions.map((q) => q.questionId);
    const sourceQuestionRows = await db
      .select()
      .from(questions)
      .where(inArray(questions.id, sourceQuestionIds));

    // Auto-copy questions to the target course
    for (const q of sourceQuestionRows) {
      const [copied] = await db
        .insert(questions)
        .values({
          courseId,
          type: q.type,
          title: q.title,
          description: q.description,
          content: q.content,
          rubric: q.rubric,
          points: q.points,
          tags: q.tags,
          createdBy: user.id,
        })
        .returning();
      questionIdMapping.set(q.id, copied.id);
    }
  } else {
    // Same course - use the same question IDs
    for (const sq of sourceQuestions) {
      questionIdMapping.set(sq.questionId, sq.questionId);
    }
  }

  // Parse due date
  const dueDateValue = parseOptionalDate(newDueDate) ?? null;

  // Create cloned assignment in a transaction-like flow
  const [cloned] = await db
    .insert(assignments)
    .values({
      courseId,
      title: newTitle?.trim() || `${source.title} (Copy)`,
      description: source.description,
      dueDate: dueDateValue,
      openDate: new Date(),
      maxAttempts: source.maxAttempts,
      mcqPenaltyPerWrongSelection: source.mcqPenaltyPerWrongSelection,
      timeLimit: source.timeLimit,
      shuffleQuestions: source.shuffleQuestions,
      isPublished: false,
      createdBy: user.id,
    })
    .returning();

  // Clone assignment questions
  if (sourceQuestions.length > 0) {
    await db.insert(assignmentQuestions).values(
      sourceQuestions.map((sq) => ({
        assignmentId: cloned.id,
        questionId: questionIdMapping.get(sq.questionId) ?? sq.questionId,
        order: sq.order,
        points: sq.points,
      }))
    );
  }

  // Clone rubrics for the questions
  const questionIds = sourceQuestions.map((sq) => sq.questionId);
  if (questionIds.length > 0) {
    const sourceRubrics = await db
      .select()
      .from(rubrics)
      .where(inArray(rubrics.questionId, questionIds));

    if (sourceRubrics.length > 0 && courseId !== source.courseId) {
      // Only need to clone rubrics if we copied questions to a different course
      for (const rubric of sourceRubrics) {
        const targetQuestionId = questionIdMapping.get(rubric.questionId);
        if (targetQuestionId && targetQuestionId !== rubric.questionId) {
          await db.insert(rubrics).values({
            questionId: targetQuestionId,
            criteria: rubric.criteria,
            totalPoints: rubric.totalPoints,
          });
        }
      }
    }
  }

  return c.json(cloned, 201);
});

export default cloneAssignmentRoute;
