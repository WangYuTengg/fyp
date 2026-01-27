import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { answers, aiGradingJobs, aiUsageStats, staffNotifications, questions } from '../../db/schema.js';
import { generateAIObject, generateAIText } from '../lib/ai.js';
import { getPrompt } from '../config/prompts.js';
import { calculateCost } from '../config/pricing.js';
import { getSignedUrl } from '../lib/storage.js';

/**
 * Graphile Worker task: auto-grade-uml
 * 
 * Grades a UML answer by:
 * 1. Text path: Compare PlantUML code strings
 * 2. Image path: Extract PlantUML from image using vision model, then compare
 */

interface AutoGradeUMLPayload {
  answerId: string;
  questionId: string;
  submissionId: string;
  userId: string;
  batchId?: string;
  jobId: string;
}

// Zod schema for UML grading response
const UMLGradingResponseSchema = z.object({
  points: z.number().min(0).describe('Points awarded (0 to maxPoints)'),
  reasoning: z.string().min(10).describe('Detailed explanation comparing diagrams'),
  confidence: z.number().min(0).max(100).describe('Confidence level (0-100)'),
  extractedUml: z.string().optional().describe('PlantUML code extracted from image'),
  criteriaScores: z.array(
    z.object({
      criterion: z.string(),
      score: z.number(),
      comment: z.string(),
    })
  ).optional().describe('Individual criterion scores if rubric provided'),
});

type UMLGradingResponse = z.infer<typeof UMLGradingResponseSchema>;

export default async function autoGradeUML(payload: AutoGradeUMLPayload, helpers: any) {
  const { answerId, questionId, submissionId, userId, batchId, jobId } = payload;
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

    const questionContent = questionData.content as any;
    const maxPoints = questionData.points;
    const referenceDiagram = questionContent.referenceDiagram;

    if (!referenceDiagram) {
      throw new Error(`Question ${questionId} has no reference UML diagram`);
    }

    const answerContent = answerData.content as any;
    const studentUmlText = answerContent.umlText;
    const fileUrl = answerData.fileUrl;

    // Determine grading path: text or image
    let studentUml: string;
    let extractedUml: string | undefined;
    let totalTokens = 0;
    const provider = process.env.LLM_PROVIDER || 'openai';
    const model = process.env.LLM_MODEL || 'gpt-4o';

    if (studentUmlText && studentUmlText.trim().length > 0) {
      // Path 1: Compare PlantUML code directly
      helpers.logger.info('Using text comparison path (PlantUML code)');
      studentUml = studentUmlText;
    } else if (fileUrl) {
      // Path 2: Extract PlantUML from image using vision model
      helpers.logger.info('Using vision extraction path (image)');
      
      // Get signed URL for image
      const signedUrl = await getSignedUrl(fileUrl);

      // Extract PlantUML using vision model
      const extractionPrompt = `You are a UML diagram expert. Analyze this image and extract the UML diagram as PlantUML syntax code.

Output ONLY the PlantUML code starting with @startuml and ending with @enduml. Include all classes, relationships, attributes, and methods visible in the diagram.

Be precise with:
- Class names and stereotypes
- Relationship types (inheritance, composition, aggregation, association)
- Multiplicity indicators
- Attribute and method signatures`;

      // Note: Vision model requires special handling with image URL
      // For now, use text-based extraction (simplified)
      // TODO: Implement proper vision API call with image URL
      const extractionResult = await generateAIText(
        `${extractionPrompt}\n\nImage URL: ${signedUrl}`,
        'You are a UML diagram analysis expert. Extract PlantUML code from diagrams.'
      );

      extractedUml = extractionResult.text;
      studentUml = extractedUml;
      totalTokens += extractionResult.tokensUsed;

      helpers.logger.info(`Extracted ${extractedUml.length} characters of PlantUML code`);
    } else {
      throw new Error('No UML text or file URL provided in answer');
    }

    // 3. Get prompt template
    const promptTemplate = getPrompt('uml');
    const systemPrompt = promptTemplate.system;

    // Build user prompt (function-based)
    const userPrompt = (promptTemplate as any).userText({
      studentUML: studentUml,
      referenceUML: referenceDiagram,
      maxPoints,
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

    // Add extractedUml to result if we used vision path
    if (extractedUml) {
      result.extractedUml = extractedUml;
    }

    // 5. Calculate cost (vision adds ~2-3x cost)
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
          promptVersion: 'v1',
          gradedAt: new Date().toISOString(),
          extractedUml: result.extractedUml || null,
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

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    helpers.logger.error(`Failed to auto-grade UML answer ${answerId}:`, error);

    // Update job as failed
    await db.update(aiGradingJobs)
      .set({
        status: 'failed',
        error: {
          message: error.message,
          stack: error.stack,
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
    await db.insert(staffNotifications).values({
      userId,
      type: 'grading_failed',
      title: 'UML auto-grading failed',
      message: `Failed to auto-grade UML answer for submission #${submissionId}`,
      data: {
        answerId,
        questionId,
        submissionId,
        error: error.message,
        batchId: batchId || null,
      },
      read: false,
    });

    throw error;
  }
}
