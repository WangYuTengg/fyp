import { describe, it, expect } from 'vitest';
import { computeContentHash } from './import-questions';

describe('computeContentHash', () => {
  it('returns consistent hash for same input', () => {
    const hash1 = computeContentHash('mcq', 'Q1', { prompt: 'hello' });
    const hash2 = computeContentHash('mcq', 'Q1', { prompt: 'hello' });
    expect(hash1).toBe(hash2);
  });

  it('returns different hash for different type', () => {
    const hash1 = computeContentHash('mcq', 'Q1', { prompt: 'hello' });
    const hash2 = computeContentHash('written', 'Q1', { prompt: 'hello' });
    expect(hash1).not.toBe(hash2);
  });

  it('returns different hash for different title', () => {
    const hash1 = computeContentHash('mcq', 'Q1', { prompt: 'hello' });
    const hash2 = computeContentHash('mcq', 'Q2', { prompt: 'hello' });
    expect(hash1).not.toBe(hash2);
  });

  it('returns different hash for different content', () => {
    const hash1 = computeContentHash('mcq', 'Q1', { prompt: 'hello' });
    const hash2 = computeContentHash('mcq', 'Q1', { prompt: 'goodbye' });
    expect(hash1).not.toBe(hash2);
  });

  it('returns a valid SHA-256 hex string', () => {
    const hash = computeContentHash('mcq', 'test', {});
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('handles complex content objects', () => {
    const content = {
      prompt: 'Which are correct?',
      options: [
        { id: '1', text: 'A', isCorrect: true },
        { id: '2', text: 'B', isCorrect: false },
      ],
      allowMultiple: false,
    };
    const hash = computeContentHash('mcq', 'Complex Q', content);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    // Same content = same hash
    expect(computeContentHash('mcq', 'Complex Q', content)).toBe(hash);
  });
});
