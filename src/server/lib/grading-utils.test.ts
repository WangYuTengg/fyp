import { describe, it, expect } from 'vitest';
import {
  applyLatePenalty,
  getEffectiveDueDate,
  resolveScoringSubmission,
  type LatePenaltyConfig,
} from './grading-utils';

// ---------------------------------------------------------------------------
// applyLatePenalty
// ---------------------------------------------------------------------------
describe('applyLatePenalty', () => {
  const due = new Date('2026-03-01T12:00:00Z');

  it('returns no penalty when type is "none"', () => {
    const config: LatePenaltyConfig = { type: 'none', value: 10, cap: null };
    const result = applyLatePenalty(85, new Date('2026-03-02T12:00:00Z'), due, config);

    expect(result.applied).toBe(false);
    expect(result.adjustedScore).toBe(85);
    expect(result.penaltyPercent).toBe(0);
  });

  it('returns no penalty when submitted before due date', () => {
    const config: LatePenaltyConfig = { type: 'fixed', value: 10, cap: null };
    const result = applyLatePenalty(85, new Date('2026-03-01T11:00:00Z'), due, config);

    expect(result.applied).toBe(false);
    expect(result.adjustedScore).toBe(85);
  });

  it('returns no penalty when submitted exactly at due date', () => {
    const config: LatePenaltyConfig = { type: 'fixed', value: 10, cap: null };
    const result = applyLatePenalty(85, due, due, config);

    expect(result.applied).toBe(false);
    expect(result.adjustedScore).toBe(85);
  });

  // Fixed penalty
  it('applies fixed penalty correctly', () => {
    const config: LatePenaltyConfig = { type: 'fixed', value: 10, cap: null };
    const result = applyLatePenalty(100, new Date('2026-03-02T12:00:00Z'), due, config);

    expect(result.applied).toBe(true);
    expect(result.penaltyPercent).toBe(10);
    expect(result.adjustedScore).toBe(90);
  });

  it('applies fixed penalty on a non-100 raw score', () => {
    const config: LatePenaltyConfig = { type: 'fixed', value: 20, cap: null };
    const result = applyLatePenalty(80, new Date('2026-03-02T12:00:00Z'), due, config);

    expect(result.penaltyPercent).toBe(20);
    expect(result.adjustedScore).toBe(64); // 80 * 0.8
  });

  // Per-day penalty
  it('applies per_day penalty for 1 day late', () => {
    const config: LatePenaltyConfig = { type: 'per_day', value: 5, cap: null };
    const result = applyLatePenalty(100, new Date('2026-03-02T12:00:00Z'), due, config);

    expect(result.applied).toBe(true);
    expect(result.penaltyPercent).toBe(5); // 1 day × 5%
    expect(result.adjustedScore).toBe(95);
  });

  it('applies per_day penalty for 3.5 days (rounds up to 4)', () => {
    const config: LatePenaltyConfig = { type: 'per_day', value: 5, cap: null };
    // 3 days 12 hours = Math.ceil(3.5) = 4 days
    const submitted = new Date('2026-03-05T00:00:00Z');
    const result = applyLatePenalty(100, submitted, due, config);

    expect(result.penaltyPercent).toBe(20); // 4 days × 5%
    expect(result.adjustedScore).toBe(80);
  });

  // Per-hour penalty
  it('applies per_hour penalty for 2 hours late', () => {
    const config: LatePenaltyConfig = { type: 'per_hour', value: 3, cap: null };
    const result = applyLatePenalty(100, new Date('2026-03-01T14:00:00Z'), due, config);

    expect(result.penaltyPercent).toBe(6); // 2 hours × 3%
    expect(result.adjustedScore).toBe(94);
  });

  it('applies per_hour penalty for 30 minutes (rounds up to 1 hour)', () => {
    const config: LatePenaltyConfig = { type: 'per_hour', value: 10, cap: null };
    const result = applyLatePenalty(100, new Date('2026-03-01T12:30:00Z'), due, config);

    expect(result.penaltyPercent).toBe(10); // Math.ceil(0.5) = 1 hour × 10%
    expect(result.adjustedScore).toBe(90);
  });

  // Cap enforcement
  it('caps penalty at the configured cap', () => {
    const config: LatePenaltyConfig = { type: 'per_day', value: 10, cap: 30 };
    // 5 days late → 50% penalty, but capped at 30%
    const submitted = new Date('2026-03-06T12:00:00Z');
    const result = applyLatePenalty(100, submitted, due, config);

    expect(result.penaltyPercent).toBe(30);
    expect(result.adjustedScore).toBe(70);
  });

  it('does not cap when penalty is below the cap', () => {
    const config: LatePenaltyConfig = { type: 'per_day', value: 5, cap: 50 };
    const result = applyLatePenalty(100, new Date('2026-03-02T12:00:00Z'), due, config);

    expect(result.penaltyPercent).toBe(5);
    expect(result.adjustedScore).toBe(95);
  });

  // Edge: penalty > 100%
  it('clamps penalty to 100% even without a cap', () => {
    const config: LatePenaltyConfig = { type: 'per_hour', value: 50, cap: null };
    // 3 hours → 150%, clamped to 100%
    const result = applyLatePenalty(100, new Date('2026-03-01T15:00:00Z'), due, config);

    expect(result.penaltyPercent).toBe(100);
    expect(result.adjustedScore).toBe(0);
  });

  // Score never goes below 0
  it('never produces a negative adjusted score', () => {
    const config: LatePenaltyConfig = { type: 'fixed', value: 100, cap: null };
    const result = applyLatePenalty(50, new Date('2026-03-02T12:00:00Z'), due, config);

    expect(result.adjustedScore).toBe(0);
  });

  // minutesLate accuracy
  it('tracks minutesLate correctly', () => {
    const config: LatePenaltyConfig = { type: 'fixed', value: 5, cap: null };
    // Exactly 90 minutes late
    const result = applyLatePenalty(100, new Date('2026-03-01T13:30:00Z'), due, config);

    expect(result.minutesLate).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// getEffectiveDueDate
// ---------------------------------------------------------------------------
describe('getEffectiveDueDate', () => {
  it('returns assignment due date when no time limit', () => {
    const dueDate = new Date('2026-03-10T12:00:00Z');
    const result = getEffectiveDueDate(dueDate, new Date(), null);
    expect(result).toEqual(dueDate);
  });

  it('returns timer expiry when no due date', () => {
    const startedAt = new Date('2026-03-01T10:00:00Z');
    const result = getEffectiveDueDate(null, startedAt, 60);

    expect(result).toEqual(new Date('2026-03-01T11:00:00Z'));
  });

  it('returns the earlier of due date and timer expiry', () => {
    const startedAt = new Date('2026-03-01T10:00:00Z');
    const dueDate = new Date('2026-03-01T10:30:00Z');
    const result = getEffectiveDueDate(dueDate, startedAt, 60);

    // Due date (10:30) is earlier than timer expiry (11:00)
    expect(result).toEqual(dueDate);
  });

  it('returns timer expiry when it is earlier than due date', () => {
    const startedAt = new Date('2026-03-01T10:00:00Z');
    const dueDate = new Date('2026-03-01T12:00:00Z');
    const result = getEffectiveDueDate(dueDate, startedAt, 30);

    // Timer expiry (10:30) is earlier than due date (12:00)
    expect(result).toEqual(new Date('2026-03-01T10:30:00Z'));
  });

  it('returns null when neither due date nor time limit is set', () => {
    const result = getEffectiveDueDate(null, null, null);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveScoringSubmission
// ---------------------------------------------------------------------------
describe('resolveScoringSubmission', () => {
  const attempts = [
    { id: 'a', attemptNumber: 1, totalScore: 70 },
    { id: 'b', attemptNumber: 2, totalScore: 90 },
    { id: 'c', attemptNumber: 3, totalScore: 80 },
  ];

  it('returns undefined for empty array', () => {
    expect(resolveScoringSubmission([], 'latest')).toBeUndefined();
    expect(resolveScoringSubmission([], 'highest')).toBeUndefined();
  });

  it('picks latest (highest attempt number)', () => {
    const result = resolveScoringSubmission(attempts, 'latest');
    expect(result?.id).toBe('c');
  });

  it('picks highest score', () => {
    const result = resolveScoringSubmission(attempts, 'highest');
    expect(result?.id).toBe('b');
  });

  it('picks latest when scores are equal', () => {
    const equalAttempts = [
      { id: 'x', attemptNumber: 1, totalScore: 80 },
      { id: 'y', attemptNumber: 2, totalScore: 80 },
    ];
    const result = resolveScoringSubmission(equalAttempts, 'latest');
    expect(result?.id).toBe('y');
  });

  it('picks first highest when multiple have the same top score', () => {
    const tied = [
      { id: 'x', attemptNumber: 1, totalScore: 90 },
      { id: 'y', attemptNumber: 2, totalScore: 90 },
    ];
    // reduce picks the first one that matches (keep 'x' since 90 > 90 is false)
    const result = resolveScoringSubmission(tied, 'highest');
    expect(result?.id).toBe('x');
  });

  it('works with a single attempt', () => {
    const single = [{ id: 'only', attemptNumber: 1, totalScore: 50 }];
    expect(resolveScoringSubmission(single, 'latest')?.id).toBe('only');
    expect(resolveScoringSubmission(single, 'highest')?.id).toBe('only');
  });

  it('handles undefined totalScore gracefully', () => {
    const noScores = [
      { id: 'a', attemptNumber: 1 },
      { id: 'b', attemptNumber: 2 },
    ];
    const result = resolveScoringSubmission(noScores, 'highest');
    // Both default to 0, first wins
    expect(result?.id).toBe('a');
  });
});
