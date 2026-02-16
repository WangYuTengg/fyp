import { useStaffDashboard } from './hooks/useStaffDashboard';
import { useCourseForm } from './hooks/useCourseForm';
import { Modal } from '../../components/Modal';
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
        onCreateClick={() => courseForm.setShowForm(true)}
      />

      <Modal
        isOpen={courseForm.showForm}
        onClose={() => courseForm.setShowForm(false)}
        title="Create New Course"
        size="lg"
      >
        <CreateCourseForm onSubmit={courseForm.createCourse} isSubmitting={courseForm.isCreating} />
      </Modal>

      <CourseGrid courses={courses} />
    </div>
  );
}
