import { useCallback, useEffect, useState } from 'react';
import { coursesApi, assignmentsApi, questionsApi, type Question } from '../../../lib/api';
import type { StaffAssignment, StaffCourse } from '../types';

export function useStaffCourse(courseId: string, user: unknown, dbUser: { role: string } | null) {
  const [course, setCourse] = useState<StaffCourse | null>(null);
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [courseData, assignmentsData, questionsData] = await Promise.all([
        coursesApi.getById(courseId),
        assignmentsApi.getByCourse(courseId),
        questionsApi.listByCourse(courseId),
      ]);
      setCourse(courseData as StaffCourse);
      setAssignments(assignmentsData as StaffAssignment[]);
      setQuestions(questionsData);
    } catch (err) {
      console.error('Failed to load course:', err);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (user && dbUser && (dbUser.role === 'admin' || dbUser.role === 'staff')) {
      loadData();
    }
  }, [user, dbUser, loadData]);

  return {
    course,
    assignments,
    questions,
    loading,
    reload: loadData,
  };
}
