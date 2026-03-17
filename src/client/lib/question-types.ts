import type { Question } from './api';

export type QuestionType = Question['type'];
export type QuestionTypeCounts = Record<QuestionType, number>;

export const QUESTION_TYPE_ORDER: QuestionType[] = ['mcq', 'written', 'uml', 'coding'];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq: 'MCQ',
  written: 'Written',
  uml: 'UML',
  coding: 'Coding',
};

const QUESTION_TYPE_BADGE_CLASSES: Record<QuestionType, string> = {
  mcq: 'border border-sky-200 bg-sky-50 text-sky-700',
  written: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  uml: 'border border-amber-200 bg-amber-50 text-amber-700',
  coding: 'border border-violet-200 bg-violet-50 text-violet-700',
};

export function createEmptyQuestionTypeCounts(): QuestionTypeCounts {
  return {
    mcq: 0,
    written: 0,
    uml: 0,
    coding: 0,
  };
}

export function countQuestionsByType<T extends { type: QuestionType }>(questions: T[]): QuestionTypeCounts {
  const counts = createEmptyQuestionTypeCounts();

  for (const question of questions) {
    counts[question.type] += 1;
  }

  return counts;
}

export function getQuestionTypeBadgeClasses(type: QuestionType): string {
  return `inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${QUESTION_TYPE_BADGE_CLASSES[type]}`;
}

export function formatQuestionTypeSummary(counts: QuestionTypeCounts): string {
  const parts = QUESTION_TYPE_ORDER
    .filter((type) => counts[type] > 0)
    .map((type) => `${QUESTION_TYPE_LABELS[type]} ${counts[type]}`);

  return parts.length > 0 ? parts.join(' | ') : 'No questions selected';
}
