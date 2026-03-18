/**
 * Pure utility functions for analytics and CSV export.
 * Separated from route handlers to enable unit testing without database dependencies.
 */

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildScoreDistribution(
  scores: number[],
  maxPts: number
): Array<{ bucket: string; count: number }> {
  if (maxPts === 0) return [{ bucket: '0', count: scores.length }];

  const bucketCount = Math.min(10, Math.max(1, maxPts));
  const bucketSize = maxPts / bucketCount;
  const distribution: Array<{ bucket: string; count: number }> = [];

  for (let i = 0; i < bucketCount; i++) {
    const low = round2(i * bucketSize);
    const high = round2((i + 1) * bucketSize);
    const count = scores.filter((s) => {
      if (i === 0) return s >= low && s <= high;
      return s > low && s <= high;
    }).length;
    distribution.push({ bucket: `${low}-${high}`, count });
  }

  return distribution;
}

export function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function computeStats(scores: number[]): {
  avg: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
} {
  if (scores.length === 0) {
    return { avg: 0, median: 0, stdDev: 0, min: 0, max: 0, q1: 0, q3: 0 };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((s, v) => s + v, 0);
  const avg = sum / n;
  const median =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];
  const variance = sorted.reduce((s, v) => s + (v - avg) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  return {
    avg: round2(avg),
    median: round2(median),
    stdDev: round2(stdDev),
    min: sorted[0],
    max: sorted[n - 1],
    q1: round2(percentile(sorted, 25)),
    q3: round2(percentile(sorted, 75)),
  };
}
