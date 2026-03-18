import { describe, it, expect } from 'vitest';
import { deterministicShuffle } from './deterministic-shuffle';

describe('deterministicShuffle', () => {
  const items = ['q1', 'q2', 'q3', 'q4', 'q5'];

  it('returns all original items', () => {
    const result = deterministicShuffle(items, 'seed-abc');
    expect(result).toHaveLength(items.length);
    expect(result.sort()).toEqual([...items].sort());
  });

  it('is deterministic - same seed produces same order', () => {
    const result1 = deterministicShuffle(items, 'submission-123');
    const result2 = deterministicShuffle(items, 'submission-123');
    expect(result1).toEqual(result2);
  });

  it('different seeds produce different orders', () => {
    const result1 = deterministicShuffle(items, 'seed-1');
    const result2 = deterministicShuffle(items, 'seed-2');
    // With 5 items it's theoretically possible but astronomically unlikely they match
    expect(result1).not.toEqual(result2);
  });

  it('does not mutate the original array', () => {
    const original = [...items];
    deterministicShuffle(items, 'seed-abc');
    expect(items).toEqual(original);
  });

  it('handles single-item array', () => {
    const result = deterministicShuffle(['only-one'], 'seed');
    expect(result).toEqual(['only-one']);
  });

  it('handles empty array', () => {
    const result = deterministicShuffle([], 'seed');
    expect(result).toEqual([]);
  });

  it('handles two items', () => {
    const result = deterministicShuffle(['a', 'b'], 'seed-abc');
    expect(result).toHaveLength(2);
    expect(result.sort()).toEqual(['a', 'b']);
  });

  it('handles large arrays without error', () => {
    const largeItems = Array.from({ length: 100 }, (_, i) => `q${i}`);
    const result = deterministicShuffle(largeItems, 'large-seed');
    expect(result).toHaveLength(100);
    expect(result.sort()).toEqual([...largeItems].sort());
  });

  it('different items with same seed produce consistent result', () => {
    const items2 = ['a', 'b', 'c', 'd', 'e'];
    const r1 = deterministicShuffle(items2, 'fixed-seed');
    const r2 = deterministicShuffle(items2, 'fixed-seed');
    expect(r1).toEqual(r2);
  });
});
