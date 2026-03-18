import { describe, it, expect } from 'vitest';
import { gradeMcqAnswer } from './mcq-grading';

// ---------------------------------------------------------------------------
// Helper to build question content
// ---------------------------------------------------------------------------
function makeQuestion(
  options: Array<{ id: string; isCorrect?: boolean }>,
  allowMultiple = false,
) {
  return { options, allowMultiple };
}

function makeAnswer(selectedOptionIds: string[]) {
  return { selectedOptionIds };
}

// ---------------------------------------------------------------------------
// Single-select (allowMultiple = false)
// ---------------------------------------------------------------------------
describe('gradeMcqAnswer — single select', () => {
  const question = makeQuestion([
    { id: 'a', isCorrect: true },
    { id: 'b' },
    { id: 'c' },
  ]);

  it('awards full points for the correct answer', () => {
    const result = gradeMcqAnswer(question, makeAnswer(['a']), 10, 1);
    expect(result.points).toBe(10);
    expect(result.feedback).toBe('Correct answer.');
  });

  it('awards 0 points for an incorrect answer', () => {
    const result = gradeMcqAnswer(question, makeAnswer(['b']), 10, 1);
    expect(result.points).toBe(0);
    expect(result.feedback).toBe('Incorrect answer.');
  });

  it('awards 0 points when no option is selected', () => {
    const result = gradeMcqAnswer(question, makeAnswer([]), 10, 1);
    expect(result.points).toBe(0);
    expect(result.feedback).toBe('Incorrect answer.');
  });

  it('awards 0 points when multiple options are selected (single-select mode)', () => {
    const result = gradeMcqAnswer(question, makeAnswer(['a', 'b']), 10, 1);
    expect(result.points).toBe(0);
    expect(result.feedback).toBe('Incorrect answer.');
  });
});

// ---------------------------------------------------------------------------
// Multi-select (allowMultiple = true)
// ---------------------------------------------------------------------------
describe('gradeMcqAnswer — multi select', () => {
  const question = makeQuestion(
    [
      { id: 'a', isCorrect: true },
      { id: 'b', isCorrect: true },
      { id: 'c' },
      { id: 'd' },
    ],
    true,
  );

  it('awards full points for exact match', () => {
    const result = gradeMcqAnswer(question, makeAnswer(['a', 'b']), 10, 1);
    expect(result.points).toBe(10);
    expect(result.feedback).toBe('Correct answer.');
  });

  it('awards full points regardless of selection order', () => {
    const result = gradeMcqAnswer(question, makeAnswer(['b', 'a']), 10, 1);
    expect(result.points).toBe(10);
  });

  it('returns negative penalty points for wrong selections', () => {
    const result = gradeMcqAnswer(question, makeAnswer(['a', 'c']), 10, 2);
    expect(result.points).toBe(-2); // 1 wrong × 2 penalty
    expect(result.feedback).toContain('penalty');
  });

  it('applies penalty per wrong selection correctly for multiple wrong', () => {
    const result = gradeMcqAnswer(question, makeAnswer(['c', 'd']), 10, 3);
    expect(result.points).toBe(-6); // 2 wrong × 3 penalty
    expect(result.feedback).toContain('6 penalty points');
    expect(result.feedback).toContain('wrong selections');
  });

  it('returns 0 for partial correct with no wrong selections', () => {
    // Selected only one of two correct answers, no wrong ones
    const result = gradeMcqAnswer(question, makeAnswer(['a']), 10, 1);
    expect(result.points).toBe(0);
    expect(result.feedback).toBe('Incorrect answer.');
  });

  it('returns 0 for no selection', () => {
    const result = gradeMcqAnswer(question, makeAnswer([]), 10, 1);
    expect(result.points).toBe(0);
    expect(result.feedback).toBe('Incorrect answer.');
  });

  it('uses default penalty of 1 when penaltyPerWrongSelection is negative', () => {
    const result = gradeMcqAnswer(question, makeAnswer(['a', 'c']), 10, -5);
    expect(result.points).toBe(-1); // Falls back to 1 per wrong
  });

  it('singular feedback for single wrong selection', () => {
    const result = gradeMcqAnswer(question, makeAnswer(['a', 'c']), 10, 1);
    expect(result.feedback).toContain('1 penalty point');
    expect(result.feedback).toContain('wrong selection.');
    expect(result.feedback).not.toContain('selections.');
  });

  it('deduplicates selected option IDs', () => {
    // Duplicate selections should be treated as one
    const result = gradeMcqAnswer(question, makeAnswer(['a', 'a', 'b']), 10, 1);
    expect(result.points).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('gradeMcqAnswer — edge cases', () => {
  it('returns 0 when question has no correct options configured', () => {
    const question = makeQuestion([
      { id: 'a' },
      { id: 'b' },
    ]);
    const result = gradeMcqAnswer(question, makeAnswer(['a']), 10, 1);
    expect(result.points).toBe(0);
    expect(result.feedback).toBe('Question has no configured correct options.');
  });

  it('handles null questionContent gracefully', () => {
    const result = gradeMcqAnswer(null, makeAnswer(['a']), 10, 1);
    expect(result.points).toBe(0);
    expect(result.feedback).toBe('Question has no configured correct options.');
  });

  it('handles null answerContent gracefully', () => {
    const question = makeQuestion([{ id: 'a', isCorrect: true }]);
    const result = gradeMcqAnswer(question, null, 10, 1);
    expect(result.points).toBe(0);
    expect(result.feedback).toBe('Incorrect answer.');
  });

  it('handles non-object answerContent gracefully', () => {
    const question = makeQuestion([{ id: 'a', isCorrect: true }]);
    const result = gradeMcqAnswer(question, 'string-answer', 10, 1);
    expect(result.points).toBe(0);
  });

  it('ignores non-string option IDs in selectedOptionIds', () => {
    const question = makeQuestion([{ id: 'a', isCorrect: true }]);
    const result = gradeMcqAnswer(question, { selectedOptionIds: [42, null, 'a'] }, 10, 1);
    expect(result.points).toBe(10); // Only 'a' is a valid string ID
  });

  it('uses specified maxPoints value', () => {
    const question = makeQuestion([{ id: 'a', isCorrect: true }]);
    const result = gradeMcqAnswer(question, makeAnswer(['a']), 25, 1);
    expect(result.points).toBe(25);
  });

  it('handles penaltyPerWrongSelection of 0 (returns 0 instead of negative)', () => {
    const question = makeQuestion(
      [{ id: 'a', isCorrect: true }, { id: 'b' }],
      true,
    );
    const result = gradeMcqAnswer(question, makeAnswer(['b']), 10, 0);
    // penaltyPoints = 1 × 0 = 0, so falls through to { points: 0 }
    expect(result.points).toBe(0);
    expect(result.feedback).toBe('Incorrect answer.');
  });
});
