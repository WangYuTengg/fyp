import { useStaffDashboard } from './hooks/useStaffDashboard';
import { useCourseForm } from './hooks/useCourseForm';
import { DashboardHeader } from './components/DashboardHeader';
import { CreateCourseForm } from './components/CreateCourseForm';
import { CourseGrid } from './components/CourseGrid';

export function StaffDashboard() {
  const { courses, loading, error, reload } = useStaffDashboard();
  const courseForm = useCourseForm(reload);

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
      <DashboardHeader 
        onCreateClick={() => courseForm.setShowForm(!courseForm.showForm)}
        showingForm={courseForm.showForm}
      />

      {courseForm.showForm && (
        <CreateCourseForm onSubmit={courseForm.createCourse} />
      )}

      <CourseGrid courses={courses} />
    </div>
  );
}
