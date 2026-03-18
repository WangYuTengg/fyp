import { describe, it, expect } from 'vitest';
import {
  percentile,
  round2,
  buildScoreDistribution,
  escapeCsv,
  computeStats,
} from './analytics-utils.js';

describe('percentile', () => {
  it('returns 0 for empty array', () => {
    expect(percentile([], 50)).toBe(0);
  });

  it('returns the single value for array of 1', () => {
    expect(percentile([7], 25)).toBe(7);
    expect(percentile([7], 50)).toBe(7);
    expect(percentile([7], 75)).toBe(7);
  });

  it('calculates median (50th percentile) correctly for odd count', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it('calculates median for even count', () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5);
  });

  it('calculates 25th percentile', () => {
    expect(percentile([1, 2, 3, 4, 5], 25)).toBe(2);
  });

  it('calculates 75th percentile', () => {
    expect(percentile([1, 2, 3, 4, 5], 75)).toBe(4);
  });

  it('interpolates between values for non-integer indices', () => {
    const sorted = [10, 20, 30, 40];
    const p25 = percentile(sorted, 25);
    // index = 0.25 * 3 = 0.75
    // lower=0 (10), upper=1 (20), frac=0.75
    // 10 + (20-10) * 0.75 = 17.5
    expect(p25).toBe(17.5);
  });

  it('returns min at 0th percentile', () => {
    expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1);
  });

  it('returns max at 100th percentile', () => {
    expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5);
  });
});

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(1.234)).toBe(1.23);
    expect(round2(1.235)).toBe(1.24);
    expect(round2(0)).toBe(0);
    expect(round2(100)).toBe(100);
  });

  it('handles negative numbers', () => {
    expect(round2(-1.234)).toBe(-1.23);
  });
});

describe('buildScoreDistribution', () => {
  it('handles maxPts = 0', () => {
    const result = buildScoreDistribution([0, 0, 0], 0);
    expect(result).toEqual([{ bucket: '0', count: 3 }]);
  });

  it('creates correct number of buckets for small maxPts', () => {
    const result = buildScoreDistribution([0, 1, 2, 3], 3);
    expect(result).toHaveLength(3);
  });

  it('creates max 10 buckets', () => {
    const result = buildScoreDistribution([5, 10, 15, 50], 100);
    expect(result).toHaveLength(10);
  });

  it('distributes scores into correct buckets', () => {
    const scores = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = buildScoreDistribution(scores, 10);

    expect(result).toHaveLength(10);
    // First bucket [0-1] includes scores >= 0 && <= 1 → 0, 1
    expect(result[0].count).toBe(2);
    // Last bucket (9-10] includes scores > 9 && <= 10 → only 10
    expect(result[9].count).toBe(1);
    // Bucket [8-9] includes scores > 8 && <= 9 → 9
    expect(result[8].count).toBe(1);
  });

  it('total counts match input length', () => {
    const scores = [0, 3, 5, 7, 10, 2, 8, 4, 6, 1];
    const result = buildScoreDistribution(scores, 10);
    const totalCount = result.reduce((s, b) => s + b.count, 0);
    expect(totalCount).toBe(scores.length);
  });

  it('handles single-point maxPts', () => {
    const result = buildScoreDistribution([0, 1, 1, 0], 1);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(4);
  });
});

describe('escapeCsv', () => {
  it('returns plain values unchanged', () => {
    expect(escapeCsv('hello')).toBe('hello');
    expect(escapeCsv('12345')).toBe('12345');
    expect(escapeCsv('')).toBe('');
  });

  it('wraps values with commas in quotes', () => {
    expect(escapeCsv('hello, world')).toBe('"hello, world"');
  });

  it('wraps values with quotes in escaped quotes', () => {
    expect(escapeCsv('say "hello"')).toBe('"say ""hello"""');
  });

  it('wraps values with newlines in quotes', () => {
    expect(escapeCsv('line1\nline2')).toBe('"line1\nline2"');
  });

  it('handles values with both commas and quotes', () => {
    expect(escapeCsv('a, "b"')).toBe('"a, ""b"""');
  });
});

describe('computeStats', () => {
  it('returns zeros for empty array', () => {
    const result = computeStats([]);
    expect(result.avg).toBe(0);
    expect(result.median).toBe(0);
    expect(result.stdDev).toBe(0);
    expect(result.min).toBe(0);
    expect(result.max).toBe(0);
  });

  it('calculates stats for single value', () => {
    const result = computeStats([5]);
    expect(result.avg).toBe(5);
    expect(result.median).toBe(5);
    expect(result.stdDev).toBe(0);
    expect(result.min).toBe(5);
    expect(result.max).toBe(5);
  });

  it('calculates stats for multiple values', () => {
    const result = computeStats([2, 4, 6, 8, 10]);
    expect(result.avg).toBe(6);
    expect(result.median).toBe(6);
    expect(result.min).toBe(2);
    expect(result.max).toBe(10);
    expect(result.stdDev).toBeGreaterThan(0);
  });

  it('calculates correct std deviation', () => {
    // [0, 10] -> avg=5, variance=25, stdDev=5
    const result = computeStats([0, 10]);
    expect(result.avg).toBe(5);
    expect(result.stdDev).toBe(5);
  });

  it('calculates quartiles correctly', () => {
    const result = computeStats([1, 2, 3, 4, 5]);
    expect(result.q1).toBe(2);
    expect(result.q3).toBe(4);
  });

  it('handles unsorted input', () => {
    const result = computeStats([5, 1, 3, 2, 4]);
    expect(result.avg).toBe(3);
    expect(result.median).toBe(3);
    expect(result.min).toBe(1);
    expect(result.max).toBe(5);
  });
});
