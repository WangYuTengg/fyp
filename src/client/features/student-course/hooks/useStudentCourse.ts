import { useCallback, useEffect, useState } from 'react';
import { coursesApi, assignmentsApi } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import type { StudentAssignment, StudentCourse } from '../types';

export function useStudentCourse(courseId: string) {
  const { user } = useAuth();
  const [course, setCourse] = useState<StudentCourse | null>(null);
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [courseData, assignmentsData] = await Promise.all([
        coursesApi.getById(courseId),
        assignmentsApi.getByCourse(courseId),
      ]);
      setCourse(courseData as StudentCourse);
      setAssignments(assignmentsData as StudentAssignment[]);
    } catch (err) {
      console.error('Failed to load course:', err);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  return {
    course,
    assignments,
    loading,
  };
}
