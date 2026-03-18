import { describe, it, expect } from 'vitest';

// Unit tests for the focus event validation logic.
// These test the pure validation rules without requiring a database connection.

type TabSwitchEvent = {
  leftAt: string;
  returnedAt: string;
  durationMs: number;
};

function validateFocusEventInput(body: Record<string, unknown>): { valid: boolean; error?: string } {
  const { leftAt, returnedAt, durationMs } = body;

  if (!leftAt || !returnedAt || typeof durationMs !== 'number') {
    return { valid: false, error: 'Missing required fields: leftAt, returnedAt, durationMs' };
  }

  if (durationMs < 0) {
    return { valid: false, error: 'durationMs must be non-negative' };
  }

  return { valid: true };
}

function shouldAutoSubmit(
  currentSwitchCount: number,
  maxTabSwitches: number | null
): boolean {
  return (
    maxTabSwitches !== null &&
    maxTabSwitches > 0 &&
    currentSwitchCount >= maxTabSwitches
  );
}

describe('focus event validation', () => {
  it('rejects missing leftAt', () => {
    const result = validateFocusEventInput({
      returnedAt: '2026-01-01T00:00:01Z',
      durationMs: 1000,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Missing required fields');
  });

  it('rejects missing returnedAt', () => {
    const result = validateFocusEventInput({
      leftAt: '2026-01-01T00:00:00Z',
      durationMs: 1000,
    });
    expect(result.valid).toBe(false);
  });

  it('rejects missing durationMs', () => {
    const result = validateFocusEventInput({
      leftAt: '2026-01-01T00:00:00Z',
      returnedAt: '2026-01-01T00:00:01Z',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects non-number durationMs', () => {
    const result = validateFocusEventInput({
      leftAt: '2026-01-01T00:00:00Z',
      returnedAt: '2026-01-01T00:00:01Z',
      durationMs: 'not a number',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects negative durationMs', () => {
    const result = validateFocusEventInput({
      leftAt: '2026-01-01T00:00:00Z',
      returnedAt: '2026-01-01T00:00:01Z',
      durationMs: -100,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('non-negative');
  });

  it('accepts valid input', () => {
    const result = validateFocusEventInput({
      leftAt: '2026-01-01T00:00:00Z',
      returnedAt: '2026-01-01T00:00:01Z',
      durationMs: 1000,
    });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts zero durationMs', () => {
    const result = validateFocusEventInput({
      leftAt: '2026-01-01T00:00:00Z',
      returnedAt: '2026-01-01T00:00:00Z',
      durationMs: 0,
    });
    expect(result.valid).toBe(true);
  });
});

describe('auto-submit threshold', () => {
  it('does not auto-submit when maxTabSwitches is null', () => {
    expect(shouldAutoSubmit(5, null)).toBe(false);
  });

  it('does not auto-submit when maxTabSwitches is 0', () => {
    expect(shouldAutoSubmit(5, 0)).toBe(false);
  });

  it('does not auto-submit when count is below threshold', () => {
    expect(shouldAutoSubmit(2, 5)).toBe(false);
  });

  it('auto-submits when count equals threshold', () => {
    expect(shouldAutoSubmit(5, 5)).toBe(true);
  });

  it('auto-submits when count exceeds threshold', () => {
    expect(shouldAutoSubmit(10, 5)).toBe(true);
  });

  it('auto-submits at threshold of 1', () => {
    expect(shouldAutoSubmit(1, 1)).toBe(true);
  });
});

describe('tab switch event shape', () => {
  it('creates a valid tab switch event', () => {
    const event: TabSwitchEvent = {
      leftAt: '2026-01-01T10:00:00Z',
      returnedAt: '2026-01-01T10:00:05Z',
      durationMs: 5000,
    };
    expect(event.leftAt).toBeTruthy();
    expect(event.returnedAt).toBeTruthy();
    expect(event.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('correctly computes durationMs from timestamps', () => {
    const leftAt = '2026-01-01T10:00:00Z';
    const returnedAt = '2026-01-01T10:00:30Z';
    const durationMs = new Date(returnedAt).getTime() - new Date(leftAt).getTime();
    expect(durationMs).toBe(30000);
  });

  it('handles sub-second durations', () => {
    const leftAt = '2026-01-01T10:00:00.000Z';
    const returnedAt = '2026-01-01T10:00:00.500Z';
    const durationMs = new Date(returnedAt).getTime() - new Date(leftAt).getTime();
    expect(durationMs).toBe(500);
  });
});
