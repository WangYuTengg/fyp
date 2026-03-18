import { Hono } from 'hono';
import { db } from '../../../db/index.js';
import {
  courses,
  assignments,
  submissions,
  marks,
  users,
  enrollments,
} from '../../../db/schema.js';
import { requireAuth, type AuthContext } from '../../middleware/auth.js';
import { eq, and, inArray } from 'drizzle-orm';
import { errorResponse, ErrorCodes } from '../../lib/errors.js';
import { getErrorMessage } from '../../lib/error-utils.js';
import { escapeCsv } from '../../lib/analytics-utils.js';

const exportGradesRoute = new Hono<AuthContext>();

/**
 * GET /api/courses/:id/export-grades
 *
 * Export grades for all assignments in a course as CSV.
 * Matrix format: students as rows, assignments as columns.
 * Staff/admin only.
 */
exportGradesRoute.get('/:id/export-grades', requireAuth, async (c) => {
  const user = c.get('user')!;

  if (user.role !== 'staff' && user.role !== 'admin') {
    return c.json(errorResponse('Forbidden', undefined, ErrorCodes.FORBIDDEN), 403);
  }

  const courseId = c.req.param('id');

  try {
    // Verify course exists
    const [course] = await db
      .select({ id: courses.id, code: courses.code, name: courses.name })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      return c.json(errorResponse('Course not found', undefined, ErrorCodes.NOT_FOUND), 404);
    }

    // Get all published assignments for the course
    const courseAssignments = await db
      .select({
        id: assignments.id,
        title: assignments.title,
      })
      .from(assignments)
      .where(
        and(
          eq(assignments.courseId, courseId),
          eq(assignments.isPublished, true)
        )
      )
      .orderBy(assignments.createdAt);

    if (courseAssignments.length === 0) {
      const csv = `# Course: ${escapeCsv(course.code)} - ${escapeCsv(course.name)}, Exported: ${new Date().toISOString().split('T')[0]}\nStudent ID,Student Name,Student Email\n`;
      return csvResponse(course.code, csv);
    }

    // Get all enrolled students
    const enrolledStudents = await db
      .select({
        userId: enrollments.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.userId, users.id))
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.role, 'student')
        )
      )
      .orderBy(users.name);

    // Get all submissions for all assignments in the course
    const assignmentIds = courseAssignments.map((a) => a.id);
    const allSubmissions = await db
      .select({
        id: submissions.id,
        assignmentId: submissions.assignmentId,
        userId: submissions.userId,
        status: submissions.status,
      })
      .from(submissions)
      .where(inArray(submissions.assignmentId, assignmentIds));

    const submittedSubmissions = allSubmissions.filter((s) => s.status !== 'draft');
    const submissionIds = submittedSubmissions.map((s) => s.id);

    // Get all marks
    let allMarks: Array<{
      submissionId: string;
      points: number;
      maxPoints: number;
    }> = [];

    if (submissionIds.length > 0) {
      allMarks = await db
        .select({
          submissionId: marks.submissionId,
          points: marks.points,
          maxPoints: marks.maxPoints,
        })
        .from(marks)
        .where(inArray(marks.submissionId, submissionIds));
    }

    // Aggregate: per submission → total earned / total max
    const submissionTotals = new Map<string, { earned: number; max: number }>();
    for (const m of allMarks) {
      const entry = submissionTotals.get(m.submissionId) ?? { earned: 0, max: 0 };
      entry.earned += m.points;
      entry.max += m.maxPoints;
      submissionTotals.set(m.submissionId, entry);
    }

    // Map: userId → assignmentId → { earned, max, status }
    type StudentAssignmentGrade = { earned: number; max: number; status: string };
    const gradeMatrix = new Map<string, Map<string, StudentAssignmentGrade>>();

    for (const sub of submittedSubmissions) {
      if (!gradeMatrix.has(sub.userId)) gradeMatrix.set(sub.userId, new Map());
      const totals = submissionTotals.get(sub.id) ?? { earned: 0, max: 0 };
      const existing = gradeMatrix.get(sub.userId)!.get(sub.assignmentId);

      // If multiple attempts, keep the best score
      if (!existing || totals.earned > existing.earned) {
        gradeMatrix.get(sub.userId)!.set(sub.assignmentId, {
          earned: totals.earned,
          max: totals.max,
          status: sub.status,
        });
      }
    }

    // Build CSV
    const assignmentHeaders = courseAssignments.map(
      (a) => escapeCsv(a.title)
    );
    const percentageHeaders = courseAssignments.map(
      (a) => `${escapeCsv(a.title)} %`
    );

    const headerRow = [
      'Student ID',
      'Student Name',
      'Student Email',
      ...assignmentHeaders,
      ...percentageHeaders,
      'Course Total',
      'Course Total %',
    ].join(',');

    const dataRows = enrolledStudents.map((student) => {
      const studentGrades = gradeMatrix.get(student.userId);
      let courseTotal = 0;
      let courseMax = 0;

      const scores = courseAssignments.map((a) => {
        const grade = studentGrades?.get(a.id);
        if (grade && grade.status === 'graded') {
          courseTotal += grade.earned;
          courseMax += grade.max;
          return String(grade.earned);
        }
        return '';
      });

      const percentages = courseAssignments.map((a) => {
        const grade = studentGrades?.get(a.id);
        if (grade && grade.status === 'graded' && grade.max > 0) {
          return ((grade.earned / grade.max) * 100).toFixed(1);
        }
        return '';
      });

      const coursePct = courseMax > 0 ? ((courseTotal / courseMax) * 100).toFixed(1) : '';

      return [
        escapeCsv(student.userId),
        escapeCsv(student.userName ?? ''),
        escapeCsv(student.userEmail),
        ...scores,
        ...percentages,
        courseMax > 0 ? String(courseTotal) : '',
        coursePct,
      ].join(',');
    });

    const metadataRow = `# Course: ${escapeCsv(course.code)} - ${escapeCsv(course.name)}, Assignments: ${courseAssignments.length}, Students: ${enrolledStudents.length}, Exported: ${new Date().toISOString().split('T')[0]}`;
    const csv = [metadataRow, headerRow, ...dataRows].join('\n');

    return csvResponse(course.code, csv);
  } catch (error: unknown) {
    console.error('Course export error:', error);
    return c.json(
      errorResponse('Failed to export course grades', getErrorMessage(error), ErrorCodes.INTERNAL_ERROR),
      500
    );
  }
});

function csvResponse(courseCode: string, content: string) {
  const sanitized = courseCode.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');
  const filename = `${sanitized}-grades.csv`;

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export default exportGradesRoute;
