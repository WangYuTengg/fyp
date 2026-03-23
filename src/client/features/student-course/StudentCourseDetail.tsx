import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useStudentCourse } from './hooks/useStudentCourse';
import { CourseHeader } from './components/CourseHeader';
import { AssignmentsList } from './components/AssignmentsList';

type StudentCourseDetailProps = {
  courseId: string;
};

export function StudentCourseDetail({ courseId }: StudentCourseDetailProps) {
  const { user, dbUser, loading: authLoading, setAdminViewAs } = useAuth();
  const navigate = useNavigate();
  const { course, assignments, loading } = useStudentCourse(courseId);

  useEffect(() => {
    if (!authLoading && !user && !dbUser) {
      navigate({ to: '/login' });
    }
    if (!authLoading && dbUser?.role === 'admin') {
      setAdminViewAs('student');
    }
  }, [authLoading, user, navigate, dbUser, setAdminViewAs]);

  if (authLoading || loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!course) {
    return <div className="text-center py-8">Course not found</div>;
  }

  return (
    <div className="space-y-6">
      <CourseHeader course={course} />
      <AssignmentsList assignments={assignments} />
    </div>
  );
}
