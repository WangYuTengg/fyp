import { describe, it, expect } from 'vitest';
import {
  isJsonRecord,
  asJsonRecord,
  getRubricCriteria,
  getMcqOptions,
  omitTeacherOnlyFields,
  toStudentSafeMcqContent,
  getAiGradingSuggestion,
} from './content-utils';

// ---------------------------------------------------------------------------
// isJsonRecord
// ---------------------------------------------------------------------------
describe('isJsonRecord', () => {
  it('returns true for plain objects', () => {
    expect(isJsonRecord({})).toBe(true);
    expect(isJsonRecord({ a: 1 })).toBe(true);
  });

  it('returns false for arrays', () => {
    expect(isJsonRecord([])).toBe(false);
    expect(isJsonRecord([1, 2])).toBe(false);
  });

  it('returns false for primitives and null', () => {
    expect(isJsonRecord(null)).toBe(false);
    expect(isJsonRecord(undefined)).toBe(false);
    expect(isJsonRecord(42)).toBe(false);
    expect(isJsonRecord('string')).toBe(false);
    expect(isJsonRecord(true)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// asJsonRecord
// ---------------------------------------------------------------------------
describe('asJsonRecord', () => {
  it('returns the object if it is a record', () => {
    const obj = { key: 'value' };
    expect(asJsonRecord(obj)).toBe(obj);
  });

  it('returns empty object for non-records', () => {
    expect(asJsonRecord(null)).toEqual({});
    expect(asJsonRecord(42)).toEqual({});
    expect(asJsonRecord([])).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// getRubricCriteria
// ---------------------------------------------------------------------------
describe('getRubricCriteria', () => {
  it('extracts valid criteria', () => {
    const rubric = {
      criteria: [
        { id: 'c1', description: 'Clarity', maxPoints: 5 },
        { id: 'c2', description: 'Correctness', maxPoints: 10 },
      ],
    };
    const result = getRubricCriteria(rubric);
    expect(result).toEqual([
      { id: 'c1', description: 'Clarity', maxPoints: 5 },
      { id: 'c2', description: 'Correctness', maxPoints: 10 },
    ]);
  });

  it('generates IDs for criteria without them', () => {
    const rubric = {
      criteria: [{ description: 'Clarity', maxPoints: 5 }],
    };
    const result = getRubricCriteria(rubric);
    expect(result).toEqual([{ id: 'criterion-1', description: 'Clarity', maxPoints: 5 }]);
  });

  it('skips criteria with missing or empty description', () => {
    const rubric = {
      criteria: [
        { id: 'c1', description: '', maxPoints: 5 },
        { id: 'c2', description: 'Valid', maxPoints: 10 },
      ],
    };
    const result = getRubricCriteria(rubric);
    expect(result).toEqual([{ id: 'c2', description: 'Valid', maxPoints: 10 }]);
  });

  it('skips criteria with non-finite maxPoints', () => {
    const rubric = {
      criteria: [
        { id: 'c1', description: 'Bad points', maxPoints: 'not-a-number' },
        { id: 'c2', description: 'Valid', maxPoints: 10 },
      ],
    };
    const result = getRubricCriteria(rubric);
    expect(result).toEqual([{ id: 'c2', description: 'Valid', maxPoints: 10 }]);
  });

  it('converts string maxPoints to number', () => {
    const rubric = {
      criteria: [{ id: 'c1', description: 'Numeric string', maxPoints: '15' }],
    };
    const result = getRubricCriteria(rubric);
    expect(result).toEqual([{ id: 'c1', description: 'Numeric string', maxPoints: 15 }]);
  });

  it('returns null when criteria is not an array', () => {
    expect(getRubricCriteria({ criteria: 'not-array' })).toBeNull();
    expect(getRubricCriteria({})).toBeNull();
  });

  it('returns null when all criteria are invalid', () => {
    const rubric = {
      criteria: [{ description: '', maxPoints: 5 }],
    };
    expect(getRubricCriteria(rubric)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(getRubricCriteria(null)).toBeNull();
    expect(getRubricCriteria(42)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getMcqOptions
// ---------------------------------------------------------------------------
describe('getMcqOptions', () => {
  it('extracts valid options with id and text', () => {
    const options = [
      { id: 'a', text: 'Option A', isCorrect: true },
      { id: 'b', text: 'Option B' },
    ];
    const result = getMcqOptions(options);
    expect(result).toEqual([
      { id: 'a', text: 'Option A' },
      { id: 'b', text: 'Option B' },
    ]);
  });

  it('skips options with missing id or text', () => {
    const options = [
      { id: 'a', text: 'Valid' },
      { id: '', text: 'No id' },
      { id: 'c', text: '' },
      { text: 'No id field' },
    ];
    const result = getMcqOptions(options);
    expect(result).toEqual([{ id: 'a', text: 'Valid' }]);
  });

  it('returns empty array for non-array input', () => {
    expect(getMcqOptions(null)).toEqual([]);
    expect(getMcqOptions({})).toEqual([]);
    expect(getMcqOptions('string')).toEqual([]);
  });

  it('skips non-object items in array', () => {
    const options = [42, null, { id: 'a', text: 'Valid' }];
    const result = getMcqOptions(options);
    expect(result).toEqual([{ id: 'a', text: 'Valid' }]);
  });
});

// ---------------------------------------------------------------------------
// omitTeacherOnlyFields
// ---------------------------------------------------------------------------
describe('omitTeacherOnlyFields', () => {
  it('removes modelAnswer from content', () => {
    const content = { prompt: 'What is...?', modelAnswer: 'The answer is 42' };
    const result = omitTeacherOnlyFields(content);
    expect(result).toEqual({ prompt: 'What is...?' });
    expect(result).not.toHaveProperty('modelAnswer');
  });

  it('returns content unchanged if no modelAnswer', () => {
    const content = { prompt: 'Question?' };
    const result = omitTeacherOnlyFields(content);
    expect(result).toEqual({ prompt: 'Question?' });
  });

  it('does not mutate the original object', () => {
    const content = { prompt: 'Q', modelAnswer: 'A' };
    omitTeacherOnlyFields(content);
    expect(content.modelAnswer).toBe('A');
  });
});

// ---------------------------------------------------------------------------
// toStudentSafeMcqContent
// ---------------------------------------------------------------------------
describe('toStudentSafeMcqContent', () => {
  it('strips isCorrect from options and sets showCorrectAnswers to false', () => {
    const content = {
      prompt: 'Pick one',
      options: [
        { id: 'a', text: 'Option A', isCorrect: true },
        { id: 'b', text: 'Option B', isCorrect: false },
      ],
      showCorrectAnswers: true,
    };
    const result = toStudentSafeMcqContent(content);
    expect(result.showCorrectAnswers).toBe(false);
    expect(result.options).toEqual([
      { id: 'a', text: 'Option A' },
      { id: 'b', text: 'Option B' },
    ]);
  });

  it('preserves other fields', () => {
    const content = {
      prompt: 'Which?',
      options: [{ id: 'a', text: 'A' }],
      allowMultiple: true,
    };
    const result = toStudentSafeMcqContent(content);
    expect(result.prompt).toBe('Which?');
    expect(result.allowMultiple).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getAiGradingSuggestion
// ---------------------------------------------------------------------------
describe('getAiGradingSuggestion', () => {
  it('extracts points and reasoning from valid suggestion', () => {
    const suggestion = { points: 8, reasoning: 'Good work overall' };
    const result = getAiGradingSuggestion(suggestion);
    expect(result).toEqual({ points: 8, reasoning: 'Good work overall' });
  });

  it('returns null when points is not a number', () => {
    expect(getAiGradingSuggestion({ points: '8', reasoning: 'text' })).toBeNull();
  });

  it('returns null when reasoning is not a string', () => {
    expect(getAiGradingSuggestion({ points: 8, reasoning: 42 })).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getAiGradingSuggestion(null)).toBeNull();
  });

  it('returns null for empty object', () => {
    expect(getAiGradingSuggestion({})).toBeNull();
  });
});
