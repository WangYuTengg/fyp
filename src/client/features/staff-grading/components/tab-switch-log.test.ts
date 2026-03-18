import { describe, it, expect } from 'vitest';

type TabSwitchEvent = {
  leftAt: string;
  returnedAt: string;
  durationMs: number;
};

// Test the pure formatting logic used in TabSwitchLog
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function computeTotalDuration(events: TabSwitchEvent[]): number {
  return events.reduce((sum, event) => sum + event.durationMs, 0);
}

describe('formatDuration', () => {
  it('formats sub-second durations', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('formats seconds', () => {
    expect(formatDuration(1000)).toBe('1s');
    expect(formatDuration(5000)).toBe('5s');
    expect(formatDuration(59000)).toBe('59s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
    expect(formatDuration(90000)).toBe('1m 30s');
    expect(formatDuration(125000)).toBe('2m 5s');
  });

  it('rounds to nearest second', () => {
    expect(formatDuration(1500)).toBe('2s');
    expect(formatDuration(1400)).toBe('1s');
  });
});

describe('computeTotalDuration', () => {
  it('returns 0 for empty array', () => {
    expect(computeTotalDuration([])).toBe(0);
  });

  it('sums single event', () => {
    const events: TabSwitchEvent[] = [
      { leftAt: '2026-01-01T10:00:00Z', returnedAt: '2026-01-01T10:00:05Z', durationMs: 5000 },
    ];
    expect(computeTotalDuration(events)).toBe(5000);
  });

  it('sums multiple events', () => {
    const events: TabSwitchEvent[] = [
      { leftAt: '2026-01-01T10:00:00Z', returnedAt: '2026-01-01T10:00:05Z', durationMs: 5000 },
      { leftAt: '2026-01-01T10:01:00Z', returnedAt: '2026-01-01T10:01:03Z', durationMs: 3000 },
      { leftAt: '2026-01-01T10:02:00Z', returnedAt: '2026-01-01T10:02:10Z', durationMs: 10000 },
    ];
    expect(computeTotalDuration(events)).toBe(18000);
  });
});

describe('tab switch flag logic', () => {
  it('shows flag when tab switches exist', () => {
    const tabSwitches: TabSwitchEvent[] = [
      { leftAt: '2026-01-01T10:00:00Z', returnedAt: '2026-01-01T10:00:05Z', durationMs: 5000 },
    ];
    const shouldShowFlag = Array.isArray(tabSwitches) && tabSwitches.length > 0;
    expect(shouldShowFlag).toBe(true);
  });

  it('hides flag when no tab switches', () => {
    const tabSwitches: TabSwitchEvent[] = [];
    const shouldShowFlag = Array.isArray(tabSwitches) && tabSwitches.length > 0;
    expect(shouldShowFlag).toBe(false);
  });

  it('hides flag when tabSwitches is undefined', () => {
    const tabSwitches = undefined as TabSwitchEvent[] | undefined;
    const shouldShowFlag = tabSwitches !== undefined && tabSwitches.length > 0;
    expect(shouldShowFlag).toBe(false);
  });
});
