import { generateText, Output } from 'ai';
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
  const model = getModel();
  
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
  const model = getModel();
  
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
export function getAIConfig() {
  return {
    provider: LLM_PROVIDER,
    model: LLM_MODEL,
  };
}
