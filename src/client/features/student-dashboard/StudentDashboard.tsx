import { useStudentDashboard } from './hooks/useStudentDashboard';
import { DashboardHeader } from './components/DashboardHeader';
import { CourseGrid } from './components/CourseGrid';

export function StudentDashboard() {
  const { courses, loading, error } = useStudentDashboard();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading courses...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader />
      <CourseGrid courses={courses} />
    </div>
  );
}
