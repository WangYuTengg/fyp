import { useCallback, useEffect, useState } from 'react';
import { coursesApi } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import type { StaffCourse } from '../types';

export function useStaffDashboard() {
  const { user, dbUser } = useAuth();
  const [courses, setCourses] = useState<StaffCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCourses = useCallback(async () => {
    try {
      setLoading(true);
      const data = (await coursesApi.getAll()) as StaffCourse[];
      setCourses(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user || dbUser) {
      loadCourses();
    }
  }, [user, dbUser, loadCourses]);

  return {
    courses,
    loading,
    error,
    reload: loadCourses,
  };
}
