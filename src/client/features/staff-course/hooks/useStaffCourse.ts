import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { coursesApi, assignmentsApi, questionsApi, tagsApi, type Question } from '../../../lib/api';
import type { StaffAssignment, StaffCourse } from '../types';

export type QuestionFilters = {
  search?: string;
  tags?: string[];
  types?: Array<'mcq' | 'written' | 'coding' | 'uml'>;
};

function getPromptFromContent(content: unknown): string {
  if (typeof content !== 'object' || content === null) return '';
  const record = content as Record<string, unknown>;
  return typeof record.prompt === 'string' ? record.prompt : '';
}

function filterQuestions(questions: Question[], filters?: QuestionFilters): Question[] {
  if (!filters) return questions;

  return questions.filter((question) => {
    // Text search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const titleMatch = question.title.toLowerCase().includes(searchLower);
      const descMatch = question.description?.toLowerCase().includes(searchLower);
      const promptMatch = getPromptFromContent(question.content).toLowerCase().includes(searchLower);
      if (!titleMatch && !descMatch && !promptMatch) return false;
    }

    // Tags filter (question must have ALL selected tags)
    if (filters.tags && filters.tags.length > 0) {
      const questionTags = question.tags || [];
      const hasAllTags = filters.tags.every((filterTag) => questionTags.includes(filterTag));
      if (!hasAllTags) return false;
    }

    // Type filter
    if (filters.types && filters.types.length > 0) {
      if (!filters.types.includes(question.type)) return false;
    }

    return true;
  });
}

export function useStaffCourse(
  courseId: string,
  user: unknown,
  dbUser: { role: string } | null,
  filters?: QuestionFilters
) {
  const isAuthorized = user && dbUser && (dbUser.role === 'admin' || dbUser.role === 'staff');

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getById(courseId) as Promise<StaffCourse>,
    enabled: !!isAuthorized,
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['assignments', courseId],
    queryFn: () => assignmentsApi.getByCourse(courseId) as Promise<StaffAssignment[]>,
    enabled: !!isAuthorized,
  });

  const { data: allQuestions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ['questions', courseId],
    queryFn: () => questionsApi.listByCourse(courseId),
    enabled: !!isAuthorized,
  });

  const { data: tags = [], isLoading: tagsLoading } = useQuery({
    queryKey: ['tags', courseId],
    queryFn: () => tagsApi.listByCourse(courseId),
    enabled: !!isAuthorized,
  });

  // Client-side filtering
  const questions = useMemo(() => {
    return filterQuestions(allQuestions, filters);
  }, [allQuestions, filters]);

  const loading = courseLoading || assignmentsLoading || questionsLoading || tagsLoading;

  return {
    course: course ?? null,
    assignments,
    questions,
    tags,
    loading,
  };
}
