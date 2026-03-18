import { describe, it, expect } from 'vitest';

describe('B1: Bulk Review Workflow - Review State Machine', () => {
  type Decision = 'accept' | 'reject' | null;
  type ReviewState = {
    answers: Array<{ id: string }>;
    decisions: Record<string, Decision>;
    currentIndex: number;
  };

  function applyDecision(
    state: ReviewState,
    answerId: string,
    decision: Decision
  ): ReviewState {
    return {
      ...state,
      decisions: { ...state.decisions, [answerId]: decision },
    };
  }

  function acceptAllRemaining(state: ReviewState): ReviewState {
    const newDecisions = { ...state.decisions };
    for (const a of state.answers) {
      if (!newDecisions[a.id]) {
        newDecisions[a.id] = 'accept';
      }
    }
    return { ...state, decisions: newDecisions };
  }

  const mockAnswers = [
    { id: 'a1' },
    { id: 'a2' },
    { id: 'a3' },
    { id: 'a4' },
    { id: 'a5' },
  ];

  it('starts with no decisions', () => {
    const state: ReviewState = { answers: mockAnswers, decisions: {}, currentIndex: 0 };
    expect(Object.keys(state.decisions)).toHaveLength(0);
  });

  it('records accept decisions', () => {
    let state: ReviewState = { answers: mockAnswers, decisions: {}, currentIndex: 0 };
    state = applyDecision(state, 'a1', 'accept');
    expect(state.decisions['a1']).toBe('accept');
  });

  it('records reject decisions', () => {
    let state: ReviewState = { answers: mockAnswers, decisions: {}, currentIndex: 0 };
    state = applyDecision(state, 'a2', 'reject');
    expect(state.decisions['a2']).toBe('reject');
  });

  it('can change a decision', () => {
    let state: ReviewState = { answers: mockAnswers, decisions: {}, currentIndex: 0 };
    state = applyDecision(state, 'a1', 'accept');
    expect(state.decisions['a1']).toBe('accept');
    state = applyDecision(state, 'a1', 'reject');
    expect(state.decisions['a1']).toBe('reject');
  });

  it('accept all remaining only affects undecided answers', () => {
    let state: ReviewState = { answers: mockAnswers, decisions: {}, currentIndex: 0 };
    state = applyDecision(state, 'a1', 'reject'); // Manually rejected
    state = applyDecision(state, 'a3', 'accept'); // Manually accepted

    state = acceptAllRemaining(state);

    expect(state.decisions['a1']).toBe('reject'); // Preserved
    expect(state.decisions['a2']).toBe('accept'); // Auto-accepted
    expect(state.decisions['a3']).toBe('accept'); // Preserved
    expect(state.decisions['a4']).toBe('accept'); // Auto-accepted
    expect(state.decisions['a5']).toBe('accept'); // Auto-accepted
  });

  it('counts accepted answers correctly', () => {
    let state: ReviewState = { answers: mockAnswers, decisions: {}, currentIndex: 0 };
    state = applyDecision(state, 'a1', 'accept');
    state = applyDecision(state, 'a2', 'reject');
    state = applyDecision(state, 'a3', 'accept');

    const acceptedIds = Object.entries(state.decisions)
      .filter(([, d]) => d === 'accept')
      .map(([id]) => id);

    expect(acceptedIds).toHaveLength(2);
    expect(acceptedIds).toContain('a1');
    expect(acceptedIds).toContain('a3');
  });

  it('navigation stays within bounds', () => {
    const clampIndex = (index: number, length: number) =>
      Math.max(0, Math.min(index, length - 1));

    expect(clampIndex(-1, 5)).toBe(0);
    expect(clampIndex(0, 5)).toBe(0);
    expect(clampIndex(2, 5)).toBe(2);
    expect(clampIndex(4, 5)).toBe(4);
    expect(clampIndex(5, 5)).toBe(4);
    expect(clampIndex(100, 5)).toBe(4);
  });
});

describe('B1: Confidence Filtering', () => {
  type Answer = { id: string; confidence: number | null };

  const answers: Answer[] = [
    { id: 'a1', confidence: 0.95 },
    { id: 'a2', confidence: 0.72 },
    { id: 'a3', confidence: 0.45 },
    { id: 'a4', confidence: null },
    { id: 'a5', confidence: 0.88 },
  ];

  it('filters low confidence answers (< 60%)', () => {
    const lowConfidence = answers.filter(
      (a) => typeof a.confidence === 'number' && a.confidence < 0.6
    );
    expect(lowConfidence).toHaveLength(1);
    expect(lowConfidence[0].id).toBe('a3');
  });

  it('categorizes confidence levels correctly', () => {
    const categorize = (confidence: number | null) => {
      if (typeof confidence !== 'number') return 'unknown';
      if (confidence >= 0.8) return 'high';
      if (confidence >= 0.6) return 'medium';
      return 'low';
    };

    expect(categorize(0.95)).toBe('high');
    expect(categorize(0.72)).toBe('medium');
    expect(categorize(0.45)).toBe('low');
    expect(categorize(null)).toBe('unknown');
  });
});
