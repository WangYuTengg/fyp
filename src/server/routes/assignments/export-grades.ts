import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import {
  assignments,
  assignmentQuestions,
  questions,
  submissions,
  answers,
  marks,
  users,
} from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, inArray } from 'drizzle-orm';
import { errorResponse, ErrorCodes } from '../../lib/errors.js';
import { getErrorMessage } from '../../lib/error-utils.js';
import { escapeCsv } from '../../lib/analytics-utils.js';

const exportGradesRoute = new Hono<AuthContext>();

/**
 * GET /api/assignments/:id/export-grades
 *
 * Export all grades for an assignment as CSV.
 * Columns: student_id, student_name, student_email, per-question scores, total, percentage, status
 * Staff/admin only.
 */
exportGradesRoute.get('/:id/export-grades', requireAuth, async (c) => {
  const user = c.get('user')!;

  if (user.role !== 'staff' && user.role !== 'admin') {
    return c.json(errorResponse('Forbidden', undefined, ErrorCodes.FORBIDDEN), 403);
  }

  const assignmentId = c.req.param('id');

  try {
    // Get assignment info
    const [assignment] = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        dueDate: assignments.dueDate,
      })
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (!assignment) {
      return c.json(errorResponse('Assignment not found', undefined, ErrorCodes.NOT_FOUND), 404);
    }

    // Get questions in order
    const aqRows = await db
      .select({
        questionId: assignmentQuestions.questionId,
        order: assignmentQuestions.order,
        pointsOverride: assignmentQuestions.points,
        questionTitle: questions.title,
        questionPoints: questions.points,
      })
      .from(assignmentQuestions)
      .innerJoin(questions, eq(assignmentQuestions.questionId, questions.id))
      .where(eq(assignmentQuestions.assignmentId, assignmentId))
      .orderBy(assignmentQuestions.order);

    // Get all non-draft submissions with user info
    const allSubmissions = await db
      .select({
        id: submissions.id,
        userId: submissions.userId,
        status: submissions.status,
        attemptNumber: submissions.attemptNumber,
        submittedAt: submissions.submittedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(submissions)
      .innerJoin(users, eq(submissions.userId, users.id))
      .where(eq(submissions.assignmentId, assignmentId));

    const nonDraftSubmissions = allSubmissions.filter((s) => s.status !== 'draft');

    if (nonDraftSubmissions.length === 0) {
      // Return CSV with header only
      const headerRow = buildCsvHeader(aqRows);
      return csvResponse(assignment.title, headerRow);
    }

    const submissionIds = nonDraftSubmissions.map((s) => s.id);

    // Get all marks with question mapping
    const allMarks = await db
      .select({
        submissionId: marks.submissionId,
        points: marks.points,
        maxPoints: marks.maxPoints,
        questionId: answers.questionId,
      })
      .from(marks)
      .innerJoin(answers, eq(marks.answerId, answers.id))
      .where(inArray(marks.submissionId, submissionIds));

    // Group marks by submission → question
    const markMap = new Map<string, Map<string, { points: number; maxPoints: number }>>();
    for (const m of allMarks) {
      if (!m.questionId) continue;
      if (!markMap.has(m.submissionId)) markMap.set(m.submissionId, new Map());
      markMap.get(m.submissionId)!.set(m.questionId, {
        points: m.points,
        maxPoints: m.maxPoints,
      });
    }

    // Build CSV
    const totalMaxPoints = aqRows.reduce(
      (s, q) => s + (q.pointsOverride ?? q.questionPoints),
      0
    );

    const headerRow = buildCsvHeader(aqRows);
    const dataRows = nonDraftSubmissions.map((sub) => {
      const subMarks = markMap.get(sub.id);
      let totalEarned = 0;

      const questionScores = aqRows.map((aq) => {
        const mark = subMarks?.get(aq.questionId);
        if (mark) {
          totalEarned += mark.points;
          return String(mark.points);
        }
        return '';
      });

      const percentage =
        totalMaxPoints > 0 ? ((totalEarned / totalMaxPoints) * 100).toFixed(1) : '0';

      return [
        escapeCsv(sub.userId),
        escapeCsv(sub.userName ?? ''),
        escapeCsv(sub.userEmail),
        ...questionScores,
        String(totalEarned),
        String(totalMaxPoints),
        percentage,
        sub.status,
        sub.submittedAt ? new Date(sub.submittedAt).toISOString() : '',
      ].join(',');
    });

    const metadataRow = `"# Assignment: ${assignment.title.replace(/"/g, '""')} | Due: ${assignment.dueDate ? new Date(assignment.dueDate).toISOString().split('T')[0] : 'N/A'} | Total Points: ${totalMaxPoints} | Exported: ${new Date().toISOString().split('T')[0]}"`;

    const csv = [metadataRow, headerRow, ...dataRows].join('\n');
    return csvResponse(assignment.title, csv);
  } catch (error: unknown) {
    console.error('Export grades error:', error);
    return c.json(
      errorResponse('Failed to export grades', getErrorMessage(error), ErrorCodes.INTERNAL_ERROR),
      500
    );
  }
});

function buildCsvHeader(
  aqRows: Array<{
    questionTitle: string;
    order: number;
    pointsOverride: number | null;
    questionPoints: number;
  }>
): string {
  const questionHeaders = aqRows.map(
    (aq) =>
      `Q${aq.order}: ${escapeCsv(aq.questionTitle)} (/${aq.pointsOverride ?? aq.questionPoints})`
  );

  return [
    'Student ID',
    'Student Name',
    'Student Email',
    ...questionHeaders,
    'Total Score',
    'Max Points',
    'Percentage',
    'Status',
    'Submitted At',
  ].join(',');
}

function csvResponse(title: string, content: string) {
  const sanitizedTitle = title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');
  const filename = `${sanitizedTitle}-grades.csv`;

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export default exportGradesRoute;
