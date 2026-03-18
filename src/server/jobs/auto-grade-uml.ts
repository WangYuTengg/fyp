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
 * Graphile Worker task: auto-grade-uml
 *
 * Grades a UML answer by comparing PlantUML code strings using LLM
 */

export interface AutoGradeUMLPayload {
  answerId: string;
  questionId: string;
  submissionId: string;
  userId: string;
  batchId?: string;
  jobId: string;
  rubricOverride?: RubricCriterion[]; // Optional rubric override from API call
}

// Zod schema for UML grading response
const UMLGradingResponseSchema = z.object({
  points: z.number().min(0).describe('Points awarded (0 to maxPoints)'),
  reasoning: z.string().min(10).describe('Detailed explanation comparing diagrams'),
  confidence: z.number().min(0).max(100).describe('Confidence level (0-100)'),
  criteriaScores: z.array(
    z.object({
      criterion: z.string(),
      score: z.number(),
      comment: z.string(),
    })
  ).optional().describe('Individual criterion scores if rubric provided'),
});

type UMLGradingResponse = z.infer<typeof UMLGradingResponseSchema>;

export default async function autoGradeUML(payload: AutoGradeUMLPayload, helpers: JobHelpers) {
  const { answerId, questionId, submissionId, userId, batchId, jobId, rubricOverride } = payload;
  const startTime = Date.now();

  try {
    helpers.logger.info(`Starting auto-grade for UML answer ${answerId}`);

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

    // Prefer modelAnswer (hidden reference used for grading). Fall back to legacy referenceDiagram.
    const referenceDiagram =
      (typeof questionContent.modelAnswer === 'string' && questionContent.modelAnswer.trim().length > 0)
        ? questionContent.modelAnswer
        : typeof questionContent.referenceDiagram === 'string'
          ? questionContent.referenceDiagram
          : undefined;

    if (!referenceDiagram || String(referenceDiagram).trim().length === 0) {
      throw new Error(`Question ${questionId} has no UML answer diagram`);
    }

    const answerContent = getAnswerContent(answerData.content);
    const studentUmlText = answerContent.umlText;

    let totalTokens = 0;
    const provider = process.env.LLM_PROVIDER || 'openai';
    const model = process.env.LLM_MODEL || 'gpt-4o';

    if (!studentUmlText || studentUmlText.trim().length === 0) {
      throw new Error('No UML text provided in answer');
    }

    helpers.logger.info('Using text comparison path (PlantUML code)');
    const studentUml = studentUmlText;

    // 3. Get prompt template
    const promptTemplate = getPrompt('uml');
    const systemPrompt = promptTemplate.system;
    const promptVersion = promptTemplate.version;

    // Use rubric override if provided, otherwise use question rubric
    const rubric = rubricOverride || getRubricCriteria(questionData.rubric);

    // Build user prompt (function-based)
    const userPrompt = promptTemplate.userText({
      studentUML: studentUml,
      referenceUML: referenceDiagram,
      maxPoints,
      rubric: rubric ?? undefined,
    });

    // 4. Call LLM with structured output for grading
    const gradingResult = await generateAIObject(
      userPrompt,
      UMLGradingResponseSchema,
      systemPrompt
    );

    const result = gradingResult.object as UMLGradingResponse;
    totalTokens += gradingResult.tokensUsed;

    // Validate points are within range
    if (result.points > maxPoints) {
      helpers.logger.warn(`LLM awarded ${result.points} points, clamping to ${maxPoints}`);
      result.points = maxPoints;
    }

    // 5. Calculate cost
    const cost = calculateCost(provider, model, totalTokens, 0);

    // 6. Update answer with AI grading suggestion
    await db.update(answers)
      .set({
        aiGradingSuggestion: {
          points: result.points,
          reasoning: result.reasoning,
          confidence: result.confidence,
          model: `${provider}/${model}`,
          tokensUsed: totalTokens,
          cost,
          promptVersion,
          gradedAt: new Date().toISOString(),
          criteriaScores: result.criteriaScores || null,
        },
        updatedAt: new Date(),
      })
      .where(eq(answers.id, answerId));

    const processingTime = Date.now() - startTime;

    // 7. Update job as completed
    await db.update(aiGradingJobs)
      .set({
        status: 'completed',
        tokensUsed: totalTokens,
        cost: cost.toFixed(6),
        completedAt: new Date(),
      })
      .where(eq(aiGradingJobs.id, jobId));

    // 8. Update usage stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
          totalTokens: existingStats.totalTokens + totalTokens,
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
        totalTokens,
        totalCost: cost.toFixed(6),
        requestCount: 1,
        successCount: 1,
        failureCount: 0,
        avgProcessingTime: processingTime,
      });
    }

    helpers.logger.info(
      `Completed auto-grade for UML answer ${answerId}: ${result.points}/${maxPoints} points (${result.confidence}% confidence)`
    );

    // Check if batch is complete and create batch notification
    if (batchId) {
      await checkBatchCompletion(batchId, userId);
    }

  } catch (error: unknown) {
    const processingTime = Date.now() - startTime;
    const errorMessage = getErrorMessage(error);
    helpers.logger.error(`Failed to auto-grade UML answer ${answerId}: ${errorMessage}`);

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

    // Update usage stats (failure)
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

    // Create staff notification
    await notifyGradingFailed(
      userId,
      answerId,
      submissionId,
      questionId,
      errorMessage,
      batchId
    );

    throw error;
  }
}
