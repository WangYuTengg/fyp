import { describe, it, expect } from 'vitest';

describe('B5: Grading Progress Dashboard - Statistics', () => {
  it('calculates completion percentage', () => {
    const calcCompletion = (graded: number, total: number) =>
      total > 0 ? Math.round((graded / total) * 100) : 0;

    expect(calcCompletion(42, 67)).toBe(63);
    expect(calcCompletion(0, 50)).toBe(0);
    expect(calcCompletion(50, 50)).toBe(100);
    expect(calcCompletion(0, 0)).toBe(0);
  });

  it('calculates grade distribution stats', () => {
    const scores = [90, 85, 72, 65, 45, 38, 95, 78, 52, 88];

    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    expect(Math.round(mean * 10) / 10).toBe(70.8);

    const sorted = [...scores].sort((a, b) => a - b);
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
    expect(median).toBe(75); // (72+78)/2

    const passCount = scores.filter((s) => s >= 50).length;
    const failCount = scores.filter((s) => s < 50).length;
    expect(passCount).toBe(8);
    expect(failCount).toBe(2);
  });

  it('handles empty scores', () => {
    const scores: number[] = [];
    const mean = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    expect(mean).toBe(0);
  });

  it('creates histogram buckets correctly', () => {
    const scores = [5, 15, 25, 35, 45, 55, 65, 75, 85, 95];

    const buckets = Array.from({ length: 10 }, (_, i) => {
      const min = i * 10;
      const max = min + 10;
      return scores.filter((s) => (i === 9 ? s >= min && s <= max : s >= min && s < max)).length;
    });

    expect(buckets).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  });
});

describe('B5: Grading Progress - Status Categories', () => {
  type SubmissionStatus = 'draft' | 'submitted' | 'late' | 'grading' | 'graded';

  it('excludes drafts from submission counts', () => {
    const submissions: { status: SubmissionStatus }[] = [
      { status: 'draft' },
      { status: 'submitted' },
      { status: 'graded' },
      { status: 'late' },
      { status: 'draft' },
    ];

    const nonDraft = submissions.filter((s) => s.status !== 'draft');
    expect(nonDraft).toHaveLength(3);
  });

  it('identifies graded vs pending', () => {
    const submissions: { status: SubmissionStatus }[] = [
      { status: 'submitted' },
      { status: 'graded' },
      { status: 'late' },
      { status: 'graded' },
      { status: 'grading' },
    ];

    const graded = submissions.filter((s) => s.status === 'graded').length;
    const pending = submissions.filter((s) => s.status !== 'graded' && s.status !== 'draft').length;
    expect(graded).toBe(2);
    expect(pending).toBe(3);
  });
});
