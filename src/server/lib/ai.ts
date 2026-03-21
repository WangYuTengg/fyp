import { generateText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { systemSettings } from '../../db/schema.js';
import { AI_CONFIG } from '../config/constants.js';

/**
 * AI Provider Factory
 * Supports OpenAI and Anthropic via Vercel AI SDK
 */

// Cache for settings to avoid DB reads on every request
let settingsCache: { provider: string; model: string; lastFetch: number } | null = null;
const CACHE_TTL = 60000; // 1 minute cache

// HTTP status codes that indicate transient errors worth retrying
const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503]);

/**
 * Get LLM settings from database or fall back to env vars
 */
async function getLLMSettings(): Promise<{ provider: string; model: string }> {
  // Return cached value if still valid
  if (settingsCache && Date.now() - settingsCache.lastFetch < CACHE_TTL) {
    return { provider: settingsCache.provider, model: settingsCache.model };
  }

  try {
    const providerSetting = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'llm_provider'))
      .limit(1);

    const modelSetting = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'llm_model'))
      .limit(1);

    const provider = providerSetting[0]?.value || process.env.LLM_PROVIDER || 'openai';
    const model = modelSetting[0]?.value || process.env.LLM_MODEL || 'gpt-4o';

    settingsCache = { provider, model, lastFetch: Date.now() };
    return { provider, model };
  } catch {
    // Fall back to env vars if DB read fails
    return {
      provider: process.env.LLM_PROVIDER || 'openai',
      model: process.env.LLM_MODEL || 'gpt-4o',
    };
  }
}

/**
 * Clear settings cache (call after settings update)
 */
export function clearLLMSettingsCache() {
  settingsCache = null;
}

/**
 * Get the configured LLM model instance
 */
async function getModel() {
  const { provider, model } = await getLLMSettings();

  if (provider === 'anthropic') {
    return anthropic(model);
  }

  // Default to OpenAI
  return openai(model);
}

/**
 * Check if an error is transient and worth retrying.
 * Only retries on 429 (rate limit) and 5xx server errors.
 */
function isTransientError(error: unknown): boolean {
  if (error === null || error === undefined) return false;

  // Check for status/statusCode on the error object
  const err = error as Record<string, unknown>;
  const status = typeof err.status === 'number'
    ? err.status
    : typeof err.statusCode === 'number'
      ? err.statusCode
      : undefined;

  if (status !== undefined) {
    return TRANSIENT_STATUS_CODES.has(status);
  }

  // Check nested data.error or response status from AI SDK errors
  if (err.data && typeof err.data === 'object') {
    const dataStatus = (err.data as Record<string, unknown>).status;
    if (typeof dataStatus === 'number') {
      return TRANSIENT_STATUS_CODES.has(dataStatus);
    }
  }

  // Check error message for common transient patterns
  const message = typeof err.message === 'string' ? err.message : '';
  if (
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('503') ||
    message.includes('502') ||
    message.includes('500') ||
    message.includes('server error') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('socket hang up')
  ) {
    return true;
  }

  return false;
}

/**
 * Retry wrapper with exponential backoff for LLM calls.
 * Only retries transient errors (429, 500, 502, 503, network errors).
 * Non-transient errors (400, 401, 403, validation) are thrown immediately.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T & { retryCount?: number }> {
  const maxRetries = AI_CONFIG.MAX_RETRIES;
  const baseDelay = AI_CONFIG.BASE_DELAY_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      // Attach retry count if we had to retry
      if (attempt > 0) {
        return { ...result, retryCount: attempt } as T & { retryCount?: number };
      }
      return result as T & { retryCount?: number };
    } catch (error: unknown) {
      lastError = error;

      // Don't retry non-transient errors
      if (!isTransientError(error)) {
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= maxRetries) {
        console.error(
          `[AI Retry] ${label}: All ${maxRetries} retries exhausted. Giving up.`
        );
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(
        `[AI Retry] ${label}: Attempt ${attempt + 1}/${maxRetries + 1} failed with transient error: ${errorMessage}. Retrying in ${delay}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but satisfy TypeScript
  throw lastError;
}

/**
 * Generate text completion using configured LLM
 */
export async function generateAIText(prompt: string, systemPrompt?: string) {
  const model = await getModel();

  return withRetry(async () => {
    const { text, usage } = await generateText({
      model,
      prompt,
      system: systemPrompt,
    });

    return {
      text,
      tokensUsed: usage?.totalTokens ?? 0,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
    };
  }, 'generateAIText');
}

/**
 * Generate structured object using configured LLM with Zod schema validation
 */
export async function generateAIObject<T extends z.ZodType>(
  prompt: string,
  schema: T,
  systemPrompt?: string
): Promise<{ object: z.infer<T>; tokensUsed: number; inputTokens: number; outputTokens: number; retryCount?: number }> {
  const model = await getModel();

  return withRetry(async () => {
    const result = await generateText({
      model,
      prompt,
      ...(systemPrompt && { system: systemPrompt }),
      output: Output.object({ schema }),
    });

    return {
      object: result.output as z.infer<T>,
      tokensUsed: result.usage?.totalTokens ?? 0,
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
    };
  }, 'generateAIObject');
}

/**
 * Extract text from image using vision-capable LLM
 */
export async function generateAIVision(imageUrl: string, prompt: string, systemPrompt?: string) {
  const model = await getModel();

  return withRetry(async () => {
    const { text, usage } = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: systemPrompt || 'You are a helpful assistant.' },
            { type: 'image', image: imageUrl },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    return {
      text,
      tokensUsed: usage?.totalTokens ?? 0,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
    };
  }, 'generateAIVision');
}

/**
 * Get current provider and model info
 */
export async function getAIConfig() {
  return getLLMSettings();
}
