import { db } from '../../db/index.js';
import { staffNotifications, aiGradingJobs } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import type { NotificationType, StaffNotificationData } from '../../lib/assessment.js';

/**
 * Create a staff notification
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: StaffNotificationData
) {
  await db.insert(staffNotifications).values({
    userId,
    type,
    title,
    message,
    data: data || null,
    read: false,
  });
}

/**
 * Check if all jobs in a batch are complete and create batch notification
 */
export async function checkBatchCompletion(batchId: string, userId: string) {
  if (!batchId) return;

  const batchJobs = await db
    .select()
    .from(aiGradingJobs)
    .where(eq(aiGradingJobs.batchId, batchId));

  const total = batchJobs.length;
  const completed = batchJobs.filter(j => j.status === 'completed').length;
  const failed = batchJobs.filter(j => j.status === 'failed').length;
  const pending = batchJobs.filter(j => j.status === 'pending' || j.status === 'processing').length;

  // All jobs are done
  if (pending === 0) {
    await createNotification(
      userId,
      'batch_completed',
      'Batch grading completed',
      `Graded ${completed} of ${total} answers${failed > 0 ? ` (${failed} failed)` : ''}`,
      {
        batchId,
        total,
        completed,
        failed,
      }
    );
  }
}

/**
 * Create a grading completed notification
 */
export async function notifyGradingCompleted(
  userId: string,
  answerId: string,
  submissionId: string,
  points: number,
  maxPoints: number,
  confidence: number
) {
  await createNotification(
    userId,
    'grading_completed',
    'Auto-grading completed',
    `Graded answer with ${points}/${maxPoints} points (${confidence}% confidence)`,
    {
      answerId,
      submissionId,
      points,
      maxPoints,
      confidence,
    }
  );
}

/**
 * Create a grading failed notification
 */
export async function notifyGradingFailed(
  userId: string,
  answerId: string,
  submissionId: string,
  questionId: string,
  error: string,
  batchId?: string
) {
  await createNotification(
    userId,
    'grading_failed',
    'Auto-grading failed',
    `Failed to auto-grade answer for submission`,
    {
      answerId,
      questionId,
      submissionId,
      error,
      batchId: batchId || null,
    }
  );
}
