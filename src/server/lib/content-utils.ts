import type {
  AiGradingSuggestion,
  McqOption,
  QuestionContent,
  RubricCriterion,
  StudentAnswerContent,
} from '../../lib/assessment.js';

type JsonRecord = Record<string, unknown>;

export function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asJsonRecord(value: unknown): JsonRecord {
  return isJsonRecord(value) ? value : {};
}

export function getQuestionContent(value: unknown): JsonRecord & Partial<QuestionContent> {
  return asJsonRecord(value) as JsonRecord & Partial<QuestionContent>;
}

export function getAnswerContent(value: unknown): JsonRecord & Partial<StudentAnswerContent> {
  return asJsonRecord(value) as JsonRecord & Partial<StudentAnswerContent>;
}

export function getRubricCriteria(value: unknown): RubricCriterion[] | null {
  const rubric = asJsonRecord(value);
  const criteria = rubric.criteria;

  if (!Array.isArray(criteria)) {
    return null;
  }

  const parsedCriteria = criteria.flatMap((criterion, index) => {
    if (!isJsonRecord(criterion)) {
      return [];
    }

    const description = typeof criterion.description === 'string' ? criterion.description.trim() : '';
    const maxPoints =
      typeof criterion.maxPoints === 'number'
        ? criterion.maxPoints
        : Number(criterion.maxPoints);

    if (!description || !Number.isFinite(maxPoints)) {
      return [];
    }

    const id =
      typeof criterion.id === 'string' && criterion.id.trim().length > 0
        ? criterion.id
        : `criterion-${index + 1}`;

    return [{ id, description, maxPoints }];
  });

  return parsedCriteria.length > 0 ? parsedCriteria : null;
}

export function getMcqOptions(value: unknown): Array<Pick<McqOption, 'id' | 'text'>> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((option) => {
    if (!isJsonRecord(option)) {
      return [];
    }

    const id = typeof option.id === 'string' ? option.id : '';
    const text = typeof option.text === 'string' ? option.text : '';

    if (!id || !text) {
      return [];
    }

    return [{ id, text }];
  });
}

export function omitTeacherOnlyFields(value: unknown): JsonRecord {
  const content = { ...getQuestionContent(value) };
  delete content.modelAnswer;
  return content;
}

export function toStudentSafeMcqContent(value: unknown): JsonRecord {
  const content = { ...getQuestionContent(value) };

  return {
    ...content,
    options: getMcqOptions(content.options),
  };
}

export function getAiGradingSuggestion(
  value: unknown
): Pick<AiGradingSuggestion, 'points' | 'reasoning'> | null {
  const suggestion = asJsonRecord(value);

  if (typeof suggestion.points !== 'number' || typeof suggestion.reasoning !== 'string') {
    return null;
  }

  return {
    points: suggestion.points,
    reasoning: suggestion.reasoning,
  };
}
