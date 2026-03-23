import { useQuery } from '@tanstack/react-query';
import { coursesApi, assignmentsApi, questionsApi, tagsApi } from '../../../lib/api';
import type { StaffAssignment, StaffCourse, StaffEnrollmentRow } from '../types';
import type { QuestionFilters } from '../utils/question-utils';

export type { QuestionFilters };

export function useStaffCourse(
  courseId: string,
  user: unknown,
  dbUser: { role: string } | null
) {
  const isAuthorized = !!dbUser && (dbUser.role === 'admin' || dbUser.role === 'staff');

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

  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['course-enrollments', courseId],
    queryFn: () => coursesApi.getEnrollments(courseId) as Promise<StaffEnrollmentRow[]>,
    enabled: !!isAuthorized,
  });

  const loading = courseLoading || assignmentsLoading || questionsLoading || tagsLoading || enrollmentsLoading;

  return {
    course: course ?? null,
    assignments,
    questions: allQuestions,
    tags,
    enrollments,
    loading,
  };
}
