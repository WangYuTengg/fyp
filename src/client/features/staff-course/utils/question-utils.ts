import type { Question } from '../../../lib/api';

export type QuestionFilters = {
  search?: string;
  tags?: string[];
  types?: Array<'mcq' | 'written' | 'coding' | 'uml'>;
};

export function getPromptFromContent(content: unknown): string {
  if (typeof content !== 'object' || content === null) return '';
  const record = content as Record<string, unknown>;
  return typeof record.prompt === 'string' ? record.prompt : '';
}

export function filterQuestions(questions: Question[], filters?: QuestionFilters): Question[] {
  if (!filters) return questions;

  return questions.filter((question) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase().trim();
      const titleMatch = question.title.toLowerCase().includes(searchLower);
      const descMatch = question.description?.toLowerCase().includes(searchLower);
      const promptMatch = getPromptFromContent(question.content).toLowerCase().includes(searchLower);

      if (!titleMatch && !descMatch && !promptMatch) {
        return false;
      }
    }

    if (filters.tags && filters.tags.length > 0) {
      const questionTags = question.tags || [];
      const hasAllTags = filters.tags.every((filterTag) => questionTags.includes(filterTag));
      if (!hasAllTags) {
        return false;
      }
    }

    if (filters.types && filters.types.length > 0 && !filters.types.includes(question.type)) {
      return false;
    }

    return true;
  });
}
