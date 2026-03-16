import { eq } from 'drizzle-orm';
import type { JobHelpers } from 'graphile-worker';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { answers, aiGradingJobs, aiUsageStats, questions } from '../../db/schema.js';
import type { RubricCriterion } from '../../lib/assessment.js';
import { generateAIObject } from '../lib/ai.js';
import { getPrompt } from '../config/prompts.js';
import { calculateCost } from '../config/pricing.js';
import { getAnswerContent, getQuestionContent, getRubricCriteria } from '../lib/content-utils.js';
import { getErrorMessage, getErrorStack } from '../lib/error-utils.js';
import { checkBatchCompletion, notifyGradingFailed } from '../lib/notifications.js';

/**
 * Graphile Worker task: auto-grade-written
 * 
 * Grades a written answer by comparing student text against model answer using LLM.
 * Uses structured output with Zod validation for reliable grading.
 */

export interface AutoGradeWrittenPayload {
  answerId: string;
  questionId: string;
  submissionId: string;
  userId: string;
  batchId?: string;
  jobId: string;
  rubricOverride?: RubricCriterion[]; // Optional rubric override from API call
}

// Zod schema for LLM grading response
const GradingResponseSchema = z.object({
  points: z.number().min(0).describe('Points awarded (0 to maxPoints)'),
  reasoning: z.string().min(10).describe('Detailed explanation of grading decision'),
  confidence: z.number().min(0).max(100).describe('Confidence level (0-100)'),
  criteriaScores: z.array(
    z.object({
      criterion: z.string(),
      score: z.number(),
      comment: z.string(),
    })
  ).optional().describe('Individual criterion scores if rubric provided'),
});

type GradingResponse = z.infer<typeof GradingResponseSchema>;

export default async function autoGradeWritten(
  payload: AutoGradeWrittenPayload,
  helpers: JobHelpers
) {
  const { answerId, questionId, submissionId, userId, batchId, jobId, rubricOverride } = payload;
  const startTime = Date.now();

  try {
    helpers.logger.info(`Starting auto-grade for written answer ${answerId}`);

    // Update job status to processing
    await db.update(aiGradingJobs)
      .set({ status: 'processing' })
      .where(eq(aiGradingJobs.id, jobId));

    // 1. Fetch answer data
    const [answerData] = await db
      .select()
      .from(answers)
      .where(eq(answers.id, answerId))
      .limit(1);

    if (!answerData) {
      throw new Error(`Answer ${answerId} not found`);
    }

    // 2. Fetch question data
    const [questionData] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    if (!questionData) {
      throw new Error(`Question ${questionId} not found`);
    }

    const questionContent = getQuestionContent(questionData.content);
    const maxPoints = questionData.points;
    const modelAnswer =
      typeof questionContent.modelAnswer === 'string' ? questionContent.modelAnswer : undefined;

    if (!modelAnswer || modelAnswer.trim().length === 0) {
      throw new Error(`Question ${questionId} has no model answer`);
    }

    const answerContent = getAnswerContent(answerData.content);
    const studentAnswer = answerContent.text?.trim() ?? '';

    if (!studentAnswer) {
      throw new Error('Student answer is empty');
    }

    // 3. Get prompt template (function-based prompts)
    const promptTemplate = getPrompt('written');
    const systemPrompt = promptTemplate.system;
    const promptVersion = promptTemplate.version;

    // Use rubric override if provided, otherwise use question rubric
    const rubric = rubricOverride || getRubricCriteria(questionData.rubric);
    const userPrompt = promptTemplate.user({
      studentAnswer,
      modelAnswer,
      maxPoints,
      rubric: rubric ?? undefined,
    });

    // 4. Call LLM with structured output
    const result = await generateAIObject(
      userPrompt,
      GradingResponseSchema,
      systemPrompt
    );

    const gradingResult = result.object as GradingResponse;
    const tokensUsed = result.tokensUsed;
    const provider = process.env.LLM_PROVIDER || 'openai';
    const model = process.env.LLM_MODEL || 'gpt-4o';

    // Validate points are within range
    if (gradingResult.points > maxPoints) {
      helpers.logger.warn(`LLM awarded ${gradingResult.points} points, clamping to ${maxPoints}`);
      gradingResult.points = maxPoints;
    }

    // 5. Calculate cost
    const cost = calculateCost(provider, model, tokensUsed, 0); // totalTokens approximation

    // 6. Update answer with AI grading suggestion
    await db.update(answers)
      .set({
        aiGradingSuggestion: {
          points: gradingResult.points,
          reasoning: gradingResult.reasoning,
          confidence: gradingResult.confidence,
          model: `${provider}/${model}`,
          tokensUsed,
          cost,
          promptVersion,
          gradedAt: new Date().toISOString(),
          criteriaScores: gradingResult.criteriaScores || null,
        },
        updatedAt: new Date(),
      })
      .where(eq(answers.id, answerId));

    const processingTime = Date.now() - startTime;

    // 7. Update job as completed
    await db.update(aiGradingJobs)
      .set({
        status: 'completed',
        tokensUsed,
        cost: cost.toFixed(6),
        completedAt: new Date(),
      })
      .where(eq(aiGradingJobs.id, jobId));

    // 8. Update usage stats (daily aggregate)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if stats entry exists for today
    const [existingStats] = await db
      .select()
      .from(aiUsageStats)
      .where(eq(aiUsageStats.date, today))
      .limit(1);

    if (existingStats) {
      const currentTotalCost = parseFloat(existingStats.totalCost);
      const currentAvgTime = existingStats.avgProcessingTime || 0;
      const newAvgTime = Math.round(
        (currentAvgTime * existingStats.requestCount + processingTime) /
        (existingStats.requestCount + 1)
      );

      await db.update(aiUsageStats)
        .set({
          totalTokens: existingStats.totalTokens + tokensUsed,
          totalCost: (currentTotalCost + cost).toFixed(6),
          requestCount: existingStats.requestCount + 1,
          successCount: existingStats.successCount + 1,
          avgProcessingTime: newAvgTime,
          updatedAt: new Date(),
        })
        .where(eq(aiUsageStats.date, today));
    } else {
      await db.insert(aiUsageStats).values({
        date: today,
        provider,
        model,
        totalTokens: tokensUsed,
        totalCost: cost.toFixed(6),
        requestCount: 1,
        successCount: 1,
        failureCount: 0,
        avgProcessingTime: processingTime,
      });
    }

    helpers.logger.info(
      `Completed auto-grade for answer ${answerId}: ${gradingResult.points}/${maxPoints} points (${gradingResult.confidence}% confidence)`
    );

    // Check if batch is complete and create batch notification
    if (batchId) {
      await checkBatchCompletion(batchId, userId);
    }

  } catch (error: unknown) {
    const processingTime = Date.now() - startTime;
    const errorMessage = getErrorMessage(error);
    helpers.logger.error(`Failed to auto-grade answer ${answerId}: ${errorMessage}`);

    // Update job as failed
    await db.update(aiGradingJobs)
      .set({
        status: 'failed',
        error: {
          message: errorMessage,
          stack: getErrorStack(error),
          timestamp: new Date().toISOString(),
        },
        completedAt: new Date(),
      })
      .where(eq(aiGradingJobs.id, jobId));

    // Update usage stats (failure count)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [existingStats] = await db
      .select()
      .from(aiUsageStats)
      .where(eq(aiUsageStats.date, today))
      .limit(1);

    if (existingStats) {
      await db.update(aiUsageStats)
        .set({
          requestCount: existingStats.requestCount + 1,
          failureCount: existingStats.failureCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(aiUsageStats.date, today));
    } else {
      await db.insert(aiUsageStats).values({
        date: today,
        provider: process.env.LLM_PROVIDER || 'openai',
        model: process.env.LLM_MODEL || 'gpt-4o',
        totalTokens: 0,
        totalCost: '0',
        requestCount: 1,
        successCount: 0,
        failureCount: 1,
        avgProcessingTime: processingTime,
      });
    }

    // Create staff notification for failure
    await notifyGradingFailed(userId, answerId, submissionId, questionId, errorMessage, batchId);

    // Re-throw error to mark job as failed in Graphile Worker
    throw error;
  }
}
