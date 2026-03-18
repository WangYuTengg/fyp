import { describe, it, expect, vi } from 'vitest';
import { calculateCost, pricing } from './pricing';

// ---------------------------------------------------------------------------
// Known providers + models
// ---------------------------------------------------------------------------
describe('calculateCost — known models', () => {
  it('calculates cost for OpenAI gpt-4o', () => {
    // 1000 input tokens + 500 output tokens
    const cost = calculateCost('openai', 'gpt-4o', 1000, 500);
    // input: (1000 / 1_000_000) * 2.50 = 0.0025
    // output: (500 / 1_000_000) * 10.00 = 0.005
    expect(cost).toBeCloseTo(0.0075, 6);
  });

  it('calculates cost for OpenAI gpt-4o-mini', () => {
    const cost = calculateCost('openai', 'gpt-4o-mini', 10_000, 5_000);
    // input: (10000 / 1M) * 0.15 = 0.0015
    // output: (5000 / 1M) * 0.60 = 0.003
    expect(cost).toBeCloseTo(0.0045, 6);
  });

  it('calculates cost for Anthropic claude-3-5-sonnet', () => {
    const cost = calculateCost('anthropic', 'claude-3-5-sonnet-20241022', 2000, 1000);
    // input: (2000 / 1M) * 3.00 = 0.006
    // output: (1000 / 1M) * 15.00 = 0.015
    expect(cost).toBeCloseTo(0.021, 6);
  });

  it('calculates cost for Anthropic claude-3-opus-latest', () => {
    const cost = calculateCost('anthropic', 'claude-3-opus-latest', 1000, 1000);
    // input: (1000 / 1M) * 15.00 = 0.015
    // output: (1000 / 1M) * 75.00 = 0.075
    expect(cost).toBeCloseTo(0.09, 6);
  });

  it('separates input vs output token pricing correctly', () => {
    const inputOnly = calculateCost('openai', 'gpt-4o', 1_000_000, 0);
    const outputOnly = calculateCost('openai', 'gpt-4o', 0, 1_000_000);

    expect(inputOnly).toBe(pricing.openai['gpt-4o'].input);
    expect(outputOnly).toBe(pricing.openai['gpt-4o'].output);
    expect(outputOnly).toBeGreaterThan(inputOnly);
  });
});

// ---------------------------------------------------------------------------
// Zero tokens
// ---------------------------------------------------------------------------
describe('calculateCost — zero tokens', () => {
  it('returns 0 for zero input and output tokens', () => {
    expect(calculateCost('openai', 'gpt-4o', 0, 0)).toBe(0);
  });

  it('returns 0 for zero input tokens (output only)', () => {
    const cost = calculateCost('openai', 'gpt-4o', 0, 500);
    expect(cost).toBeGreaterThan(0);
  });

  it('returns 0 for zero output tokens (input only)', () => {
    const cost = calculateCost('openai', 'gpt-4o', 500, 0);
    expect(cost).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Large token counts (decimal precision)
// ---------------------------------------------------------------------------
describe('calculateCost — large token counts', () => {
  it('handles large token counts without floating point errors', () => {
    const cost = calculateCost('openai', 'gpt-4o', 5_000_000, 2_000_000);
    // input: 5 * 2.50 = 12.50
    // output: 2 * 10.00 = 20.00
    expect(cost).toBeCloseTo(32.5, 4);
  });

  it('rounds to 6 decimal places', () => {
    const cost = calculateCost('openai', 'gpt-4o', 1, 1);
    // input: (1 / 1M) * 2.50 = 0.0000025
    // output: (1 / 1M) * 10.00 = 0.00001
    const costStr = cost.toString();
    const decimalPlaces = costStr.includes('.') ? costStr.split('.')[1].length : 0;
    expect(decimalPlaces).toBeLessThanOrEqual(6);
  });
});

// ---------------------------------------------------------------------------
// Unknown provider / model
// ---------------------------------------------------------------------------
describe('calculateCost — unknown provider or model', () => {
  it('returns 0 for unknown provider', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cost = calculateCost('google', 'gemini-pro', 1000, 500);
    expect(cost).toBe(0);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Unknown provider'));
    spy.mockRestore();
  });

  it('returns 0 for unknown model within known provider', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cost = calculateCost('openai', 'gpt-5-turbo', 1000, 500);
    expect(cost).toBe(0);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Unknown model'));
    spy.mockRestore();
  });

  it('returns 0 for empty string provider', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(calculateCost('', 'gpt-4o', 1000, 500)).toBe(0);
    spy.mockRestore();
  });
});
