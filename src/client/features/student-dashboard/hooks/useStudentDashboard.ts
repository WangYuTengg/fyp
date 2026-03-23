import { useEffect, useState } from 'react';
import { coursesApi } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import type { StudentCourse } from '../types';

export function useStudentDashboard() {
  const { user, dbUser } = useAuth();
  const [courses, setCourses] = useState<StudentCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user && !dbUser) return;

    const loadCourses = async () => {
      try {
        setLoading(true);
        const data = await coursesApi.getAll();
        setCourses(data as StudentCourse[]);
      } catch (err: unknown) {
        if (err instanceof Error) setError(err.message);
        else setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, [user, dbUser]);

  return {
    courses,
    loading,
    error,
  };
}
