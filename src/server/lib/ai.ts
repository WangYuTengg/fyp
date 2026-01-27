import { generateText, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

/**
 * AI Provider Factory
 * Supports OpenAI and Anthropic via Vercel AI SDK
 */

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'openai';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o';

/**
 * Get the configured LLM model instance
 */
function getModel() {
  if (LLM_PROVIDER === 'anthropic') {
    return anthropic(LLM_MODEL);
  }
  
  // Default to OpenAI
  return openai(LLM_MODEL);
}

/**
 * Generate text completion using configured LLM
 */
export async function generateAIText(prompt: string, systemPrompt?: string) {
  const model = getModel();
  
  const { text, usage } = await generateText({
    model,
    prompt,
    system: systemPrompt,
  });
  
  return {
    text,
    tokensUsed: usage?.totalTokens ?? 0,
    inputTokens: (usage?.totalTokens ?? 0) - (usage?.totalTokens ?? 0), // AI SDK doesn't expose separate input/output in v3
    outputTokens: usage?.totalTokens ?? 0,
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
  const model = getModel();
  
  const result = await generateObject({
    model,
    schema,
    prompt,
    ...(systemPrompt && { system: systemPrompt }),
  } as any); // Type assertion needed due to complex AI SDK generics
  
  return {
    object: result.object as z.infer<T>,
    tokensUsed: result.usage?.totalTokens ?? 0,
    inputTokens: 0,
    outputTokens: result.usage?.totalTokens ?? 0,
  };
}

/**
 * Get current provider and model info
 */
export function getAIConfig() {
  return {
    provider: LLM_PROVIDER,
    model: LLM_MODEL,
  };
}
