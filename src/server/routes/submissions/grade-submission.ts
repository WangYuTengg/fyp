import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import { submissions, marks } from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, and } from 'drizzle-orm';
import { bulkGradeSchema } from '../../lib/validation-schemas.js';
import { errorResponse, ErrorCodes } from '../../lib/errors.js';

const gradeSubmissionRoute = new Hono<AuthContext>();

// Grade a submission (staff/admin only)
gradeSubmissionRoute.post('/:submissionId/grade', requireAuth, async (c) => {
  const submissionId = c.req.param('submissionId');
  const user = c.get('user')!;

  if (user.role !== 'admin' && user.role !== 'staff') {
    return c.json(errorResponse('Forbidden', undefined, ErrorCodes.FORBIDDEN), 403);
  }

  const body = await c.req.json();

  // Validate request body - support both bulk and single grade formats
  const bulkValidation = bulkGradeSchema.safeParse(body);

  let gradesList: Array<{ answerId?: string; points: number; maxPoints: number; feedback?: string }>;
  if (bulkValidation.success) {
    gradesList = bulkValidation.data.grades;
  } else {
    // Try legacy single-grade format
    gradesList = [body as { answerId: string; points: number; maxPoints: number; feedback?: string }];

    // Validate single grade has required fields
    if (gradesList[0].points === undefined || gradesList[0].maxPoints === undefined) {
      return c.json(
        errorResponse('Points and maxPoints required for all grades', undefined, ErrorCodes.VALIDATION_ERROR),
        400
      );
    }
  }

  const createdMarks = [];

  for (const grade of gradesList) {
    const { answerId, points, maxPoints, feedback } = grade;

    // Prevent duplicate marks: check if this answer already has a mark
    if (answerId) {
      const [existingMark] = await db
        .select()
        .from(marks)
        .where(
          and(
            eq(marks.submissionId, submissionId),
            eq(marks.answerId, answerId)
          )
        )
        .limit(1);

      if (existingMark) {
        // Update existing mark instead of creating duplicate
        const [updated] = await db
          .update(marks)
          .set({
            points,
            maxPoints,
            feedback,
            markedBy: user.id,
            updatedAt: new Date(),
          })
          .where(eq(marks.id, existingMark.id))
          .returning();

        createdMarks.push(updated);
        continue;
      }
    }

    const [mark] = await db
      .insert(marks)
      .values({
        submissionId,
        answerId: answerId || null,
        points,
        maxPoints,
        feedback,
        markedBy: user.id,
        isAiAssisted: false,
      })
      .returning();

    createdMarks.push(mark);
  }

  // Update submission status
  await db
    .update(submissions)
    .set({
      status: 'graded',
      gradedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(submissions.id, submissionId));

  return c.json(createdMarks, 201);
});

export default gradeSubmissionRoute;
