import { useQuery } from '@tanstack/react-query';
import { coursesApi, assignmentsApi, questionsApi } from '../../../lib/api';
import type { StaffAssignment, StaffCourse } from '../types';

export function useStaffCourse(courseId: string, user: unknown, dbUser: { role: string } | null) {
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

  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ['questions', courseId],
    queryFn: () => questionsApi.listByCourse(courseId),
    enabled: !!isAuthorized,
  });

  const loading = courseLoading || assignmentsLoading || questionsLoading;

  return {
    course: course ?? null,
    assignments,
    questions,
    loading,
  };
}
