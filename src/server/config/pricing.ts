/**
 * LLM Pricing Configuration
 * Prices per 1M tokens (as of January 2026)
 * Update these values monthly from provider documentation
 */

export const pricing = {
  openai: {
    'gpt-4o': {
      input: 2.50,   // $ per 1M input tokens
      output: 10.00, // $ per 1M output tokens
    },
    'gpt-4o-2024-08-06': {
      input: 2.50,
      output: 10.00,
    },
    'gpt-4o-mini': {
      input: 0.15,
      output: 0.60,
    },
  },
  anthropic: {
    'claude-3-5-sonnet-20241022': {
      input: 3.00,
      output: 15.00,
    },
    'claude-3-5-sonnet-latest': {
      input: 3.00,
      output: 15.00,
    },
    'claude-3-opus-latest': {
      input: 15.00,
      output: 75.00,
    },
  },
} as const;

export type PricingProvider = keyof typeof pricing;
export type PricingModel<P extends PricingProvider> = keyof typeof pricing[P];

/**
 * Calculate cost for token usage
 * @param provider - LLM provider (openai/anthropic)
 * @param model - Model name
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in dollars
 */
export function calculateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const providerPricing = pricing[provider as PricingProvider];
  if (!providerPricing) {
    console.warn(`Unknown provider: ${provider}, cost calculation unavailable`);
    return 0;
  }

  const modelPricing = providerPricing[model as keyof typeof providerPricing] as { input: number; output: number } | undefined;
  if (!modelPricing) {
    console.warn(`Unknown model: ${model} for provider ${provider}, cost calculation unavailable`);
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
  const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

  return Number((inputCost + outputCost).toFixed(6)); // Round to 6 decimal places
}
