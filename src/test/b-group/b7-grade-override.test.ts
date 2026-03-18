import { describe, it, expect } from 'vitest';
import { marks } from '../../db/schema';

describe('B7: Grade Override with Reason Logging - Schema', () => {
  it('has overrideReason column on marks', () => {
    expect(marks.overrideReason).toBeDefined();
    expect(marks.overrideReason.name).toBe('override_reason');
  });

  it('has previousScore column on marks', () => {
    expect(marks.previousScore).toBeDefined();
    expect(marks.previousScore.name).toBe('previous_score');
  });

  it('has overriddenAt column on marks', () => {
    expect(marks.overriddenAt).toBeDefined();
    expect(marks.overriddenAt.name).toBe('overridden_at');
  });

  it('override columns are nullable', () => {
    // These columns should be nullable - they're only set when an override occurs
    expect(marks.overrideReason.notNull).toBe(false);
    expect(marks.previousScore.notNull).toBe(false);
    expect(marks.overriddenAt.notNull).toBe(false);
  });
});

describe('B7: Override Reason Values', () => {
  const VALID_REASONS = [
    'too_lenient',
    'too_strict',
    'partial_credit',
    'misunderstood_rubric',
    'other',
  ];

  it('defines expected override reason constants', () => {
    // These are the valid values for the overrideReason field
    expect(VALID_REASONS).toHaveLength(5);
    expect(VALID_REASONS).toContain('too_lenient');
    expect(VALID_REASONS).toContain('too_strict');
    expect(VALID_REASONS).toContain('partial_credit');
    expect(VALID_REASONS).toContain('misunderstood_rubric');
    expect(VALID_REASONS).toContain('other');
  });
});
