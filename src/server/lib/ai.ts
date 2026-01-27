import { generateText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { systemSettings } from '../../db/schema.js';

/**
 * AI Provider Factory
 * Supports OpenAI and Anthropic via Vercel AI SDK
 */

// Cache for settings to avoid DB reads on every request
let settingsCache: { provider: string; model: string; lastFetch: number } | null = null;
const CACHE_TTL = 60000; // 1 minute cache

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
 * Generate text completion using configured LLM
 */
export async function generateAIText(prompt: string, systemPrompt?: string) {
  const model = await getModel();
  
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
}

/**
 * Generate structured object using configured LLM with Zod schema validation
 */
export async function generateAIObject<T extends z.ZodType>(
  prompt: string,
  schema: T,
  systemPrompt?: string
): Promise<{ object: z.infer<T>; tokensUsed: number; inputTokens: number; outputTokens: number }> {
  const model = await getModel();
  
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
}

/**
 * Extract text from image using vision-capable LLM
 */
export async function generateAIVision(imageUrl: string, prompt: string, systemPrompt?: string) {
  const model = await getModel();
  
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
}

/**
 * Get current provider and model info
 */
export async function getAIConfig() {
  return getLLMSettings();
}
