import { and, eq, sql, inArray } from 'drizzle-orm';
import type { JobHelpers } from 'graphile-worker';
import { db } from '../../db/index.js';
import {
  answers,
  assignmentQuestions,
  assignments,
  marks,
  questions,
  submissions,
  enrollments,
  staffNotifications,
} from '../../db/schema.js';
import { applyLatePenalty, getEffectiveDueDate, type LatePenaltyConfig } from '../lib/grading-utils.js';
import { gradeMcqAnswer } from '../lib/mcq-grading.js';

/**
 * Graphile Worker task: auto-submit-expired
 *
 * Runs every minute via crontab. Finds all draft submissions whose timer
 * has expired and auto-submits them, then triggers MCQ auto-grading.
 */
export default async function autoSubmitExpired(
  _payload: unknown,
  helpers: JobHelpers,
): Promise<void> {
  helpers.logger.info('auto-submit-expired: checking for expired submissions...');

  // Find draft submissions past their time limit
  // Join submissions (status = 'draft') with assignments (timeLimit IS NOT NULL)
  // Filter: submissions.startedAt + (assignments.timeLimit * interval '1 minute') < NOW()
  const expiredSubmissions = await db
    .select({
      submissionId: submissions.id,
      assignmentId: submissions.assignmentId,
      userId: submissions.userId,
      startedAt: submissions.startedAt,
      assignmentTitle: assignments.title,
      courseId: assignments.courseId,
      timeLimit: assignments.timeLimit,
      mcqPenaltyPerWrongSelection: assignments.mcqPenaltyPerWrongSelection,
      latePenaltyType: assignments.latePenaltyType,
      latePenaltyValue: assignments.latePenaltyValue,
      latePenaltyCap: assignments.latePenaltyCap,
      dueDate: assignments.dueDate,
    })
    .from(submissions)
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .where(
      and(
        eq(submissions.status, 'draft'),
        sql`${assignments.timeLimit} IS NOT NULL`,
        sql`${submissions.startedAt} + (${assignments.timeLimit} * interval '1 minute') < NOW()`,
      ),
    );

  if (expiredSubmissions.length === 0) {
    helpers.logger.info('auto-submit-expired: no expired submissions found');
    return;
  }

  helpers.logger.info(
    `auto-submit-expired: found ${expiredSubmissions.length} expired submission(s)`,
  );

  // Group by assignment for batch notifications
  const byAssignment = new Map<
    string,
    { title: string; courseId: string; submissionIds: string[] }
  >();

  const now = new Date();

  for (const expired of expiredSubmissions) {
    try {
      // Auto-grade MCQ answers
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
            eq(assignmentQuestions.assignmentId, expired.assignmentId),
            eq(assignmentQuestions.questionId, questions.id),
          ),
        )
        .where(eq(answers.submissionId, expired.submissionId));

      for (const answer of submissionAnswers) {
        if (answer.questionType !== 'mcq') continue;

        const maxPoints = answer.assignmentQuestionPoints ?? answer.questionPoints;
        const penaltyPerWrongSelection =
          typeof expired.mcqPenaltyPerWrongSelection === 'number'
            ? expired.mcqPenaltyPerWrongSelection
            : 1;
        const grade = gradeMcqAnswer(
          answer.questionContent,
          answer.answerContent,
          maxPoints,
          penaltyPerWrongSelection,
        );

        const [existingMark] = await db
          .select()
          .from(marks)
          .where(
            and(eq(marks.submissionId, expired.submissionId), eq(marks.answerId, answer.answerId)),
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
        } else {
          await db.insert(marks).values({
            submissionId: expired.submissionId,
            answerId: answer.answerId,
            points: grade.points,
            maxPoints,
            feedback: grade.feedback,
            markedBy: null,
            isAiAssisted: false,
            aiSuggestionAccepted: false,
          });
        }
      }

      // Determine if all questions are MCQ (auto-complete grading)
      const [nonMcqQuestion] = await db
        .select({ id: questions.id })
        .from(assignmentQuestions)
        .innerJoin(questions, eq(assignmentQuestions.questionId, questions.id))
        .where(
          and(
            eq(assignmentQuestions.assignmentId, expired.assignmentId),
            inArray(questions.type, ['written', 'uml', 'coding']),
          ),
        )
        .limit(1);

      const shouldAutoCompleteGrading = !nonMcqQuestion;

      // Calculate late penalty
      let latePenaltyApplied: string | null = null;
      let latePenaltyDetails: Record<string, unknown> | null = null;

      const penaltyConfig: LatePenaltyConfig = {
        type: (expired.latePenaltyType as LatePenaltyConfig['type']) ?? 'none',
        value: expired.latePenaltyValue ? Number(expired.latePenaltyValue) : 0,
        cap: expired.latePenaltyCap ? Number(expired.latePenaltyCap) : null,
      };

      if (penaltyConfig.type !== 'none') {
        const effectiveDueDate = getEffectiveDueDate(
          expired.dueDate,
          expired.startedAt,
          expired.timeLimit,
        );

        if (effectiveDueDate) {
          const penaltyResult = applyLatePenalty(100, now, effectiveDueDate, penaltyConfig);
          if (penaltyResult.applied) {
            latePenaltyApplied = String(penaltyResult.penaltyPercent);
            latePenaltyDetails = {
              type: penaltyConfig.type,
              value: penaltyConfig.value,
              cap: penaltyConfig.cap,
              minutesLate: penaltyResult.minutesLate,
              penaltyPercent: penaltyResult.penaltyPercent,
            };
          }
        }
      }

      // Update submission status
      await db
        .update(submissions)
        .set({
          status: shouldAutoCompleteGrading ? 'graded' : 'submitted',
          submittedAt: now,
          gradedAt: shouldAutoCompleteGrading ? now : null,
          autoSubmitted: true,
          latePenaltyApplied,
          latePenaltyDetails,
          updatedAt: now,
        })
        .where(eq(submissions.id, expired.submissionId));

      helpers.logger.info(
        `auto-submit-expired: auto-submitted submission ${expired.submissionId} for assignment "${expired.assignmentTitle}"`,
      );

      // Track for batch notification
      if (!byAssignment.has(expired.assignmentId)) {
        byAssignment.set(expired.assignmentId, {
          title: expired.assignmentTitle,
          courseId: expired.courseId,
          submissionIds: [],
        });
      }
      byAssignment.get(expired.assignmentId)!.submissionIds.push(expired.submissionId);
    } catch (err) {
      helpers.logger.error(
        `auto-submit-expired: failed to auto-submit ${expired.submissionId}: ${err}`,
      );
    }
  }

  // Send batch notifications to staff for each assignment
  for (const [assignmentId, info] of byAssignment) {
    try {
      // Find all staff enrolled in the course
      const courseStaff = await db
        .select({ userId: enrollments.userId })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.courseId, info.courseId),
            inArray(enrollments.role, ['lecturer', 'ta', 'lab_exec']),
          ),
        );

      const count = info.submissionIds.length;
      const message = `${count} submission${count === 1 ? ' was' : 's were'} auto-submitted for "${info.title}" due to timer expiry.`;

      for (const staff of courseStaff) {
        await db.insert(staffNotifications).values({
          userId: staff.userId,
          type: 'auto_submitted',
          title: 'Submissions auto-submitted',
          message,
          data: {
            assignmentId,
            assignmentTitle: info.title,
            submissionCount: count,
            submissionIds: info.submissionIds,
          },
          read: false,
        });
      }
    } catch (err) {
      helpers.logger.error(
        `auto-submit-expired: failed to create notification for assignment ${assignmentId}: ${err}`,
      );
    }
  }

  helpers.logger.info(
    `auto-submit-expired: completed. Processed ${expiredSubmissions.length} submission(s).`,
  );
}
