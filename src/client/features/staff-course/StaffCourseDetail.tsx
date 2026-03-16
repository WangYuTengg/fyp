import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../../components/Modal';
import { useStaffCourse } from './hooks/useStaffCourse';
import { useAssignmentForm } from './hooks/useAssignmentForm';
import { useQuestionForm } from './hooks/useQuestionForm';
import { CourseHeader } from './components/CourseHeader';
import { CreateAssignmentForm } from './components/CreateAssignmentForm';
import { CreateQuestionForm } from './components/CreateQuestionForm';
import { AssignmentCard } from './components/AssignmentCard';
import { QuestionPoolPanel } from './components/QuestionPoolPanel';
import { TagManager } from './components/TagManager';
import { CourseRoster } from './components/CourseRoster';
import { BulkEnrollModal } from './components/BulkEnrollModal';
import { AddStudentsPanel } from './components/AddStudentsPanel';
import { coursesApi } from '../../lib/api';
import { AutoGradingDashboard } from '../staff-grading/AutoGradingDashboard';
import { SettingsTab } from '../staff-grading/components/SettingsTab';

type StaffCourseDetailProps = {
  courseId: string;
};

type TabType = 'assignments' | 'questions' | 'roster' | 'auto-grading' | 'settings';

export function StaffCourseDetail({ courseId }: StaffCourseDetailProps) {
  const { user, dbUser, loading: authLoading, setAdminViewAs } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('assignments');
  const [showTagManager, setShowTagManager] = useState(false);
  const [showBulkEnroll, setShowBulkEnroll] = useState(false);
  const [removingEnrollmentId, setRemovingEnrollmentId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { course, assignments, questions, tags, enrollments, loading } = useStaffCourse(courseId, user, dbUser);
  const assignmentForm = useAssignmentForm(courseId);
  const questionForm = useQuestionForm(courseId, assignments);

  const removeEnrollmentMutation = useMutation({
    mutationFn: (enrollmentId: string) => coursesApi.removeEnrollment(courseId, enrollmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-enrollments', courseId] });
      setRemovingEnrollmentId(null);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to remove enrollment: ' + message);
      setRemovingEnrollmentId(null);
    },
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate({ to: '/login' });
      } else if (dbUser && dbUser.role !== 'admin' && dbUser.role !== 'staff') {
        navigate({ to: '/student' });
      } else if (dbUser?.role === 'admin') {
        setAdminViewAs('staff');
      }
    }
  }, [authLoading, user, dbUser, navigate, setAdminViewAs]);

  if (authLoading || loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!course) {
    return <div className="text-center py-8">Course not found</div>;
  }

  return (
    <div className="space-y-6">
      <CourseHeader course={course} />

      <div className="bg-white shadow rounded-lg">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              type="button"
              onClick={() => setActiveTab('assignments')}
              className={`${
                activeTab === 'assignments'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
            >
              Assignments
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('questions')}
              className={`${
                activeTab === 'questions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
            >
              Question Pool
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className={`${
                activeTab === 'roster'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
            >
              Roster
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('auto-grading')}
              className={`${
                activeTab === 'auto-grading'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
            >
              Auto-Grading
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`${
                activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm transition-colors`}
            >
              Settings
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'assignments' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Assignments</h2>
                <button
                  type="button"
                  onClick={() => assignmentForm.setShowForm(true)}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
                >
                  Create Assignment
                </button>
              </div>

              <Modal
                isOpen={assignmentForm.showForm}
                onClose={() => assignmentForm.setShowForm(false)}
                title="Create Assignment"
                size="xl"
              >
                <CreateAssignmentForm
                  questions={questions}
                  selectedQuestionIds={assignmentForm.selectedQuestionIds}
                  setSelectedQuestionIds={assignmentForm.setSelectedQuestionIds}
                  onSubmit={assignmentForm.createAssignment}
                  isSubmitting={assignmentForm.isCreating}
                />
              </Modal>

              <div className="space-y-4">
                {assignments.map((assignment) => (
                  <AssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    onTogglePublish={assignmentForm.togglePublish}
                    onDelete={assignmentForm.deleteAssignment}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'questions' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Question Pool</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTagManager(!showTagManager)}
                    className="bg-gray-500 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded"
                  >
                    {showTagManager ? 'Hide Tags' : 'Manage Tags'}
                  </button>
                  <button
                    type="button"
                    onClick={() => questionForm.setShowForm(true)}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
                  >
                    Create Question
                  </button>
                </div>
              </div>

              {showTagManager && (
                <TagManager tags={tags} />
              )}

              <Modal
                isOpen={questionForm.showForm}
                onClose={() => questionForm.setShowForm(false)}
                title="Create Question"
                size="2xl"
              >
                <CreateQuestionForm
                  questionType={questionForm.questionType}
                  setQuestionType={questionForm.setQuestionType}
                  mcqOptions={questionForm.mcqOptions}
                  setMcqOptions={questionForm.setMcqOptions}
                  onSubmit={questionForm.createQuestion}
                  isSubmitting={questionForm.isCreating}
                  assignments={assignments}
                  selectedAssignmentId={questionForm.selectedAssignmentId}
                  setSelectedAssignmentId={questionForm.setSelectedAssignmentId}
                  tags={tags}
                />
              </Modal>
              <QuestionPoolPanel
                questions={questions}
                availableTags={tags}
                onDelete={questionForm.deleteQuestion}
                onEdit={questionForm.editQuestion}
              />
            </div>
          )}

          {activeTab === 'roster' && (
            <div className="space-y-6">
              <AddStudentsPanel
                courseId={courseId}
                enrolledUserIds={enrollments.map((row) => row.user.id)}
              />
              <CourseRoster
                enrollments={enrollments}
                onBulkEnroll={() => setShowBulkEnroll(true)}
                onRemove={(enrollmentId) => {
                  setRemovingEnrollmentId(enrollmentId);
                  removeEnrollmentMutation.mutate(enrollmentId);
                }}
                removingId={removingEnrollmentId}
              />
            </div>
          )}

          {activeTab === 'auto-grading' && (
            <AutoGradingDashboard courseId={courseId} courseCode={course.code} />
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-2xl font-bold text-gray-900">Course Settings</h2>
                <p className="text-sm text-gray-600 mt-2">
                  Configure course-level automatic grading behavior.
                </p>
              </div>
              <SettingsTab />
            </div>
          )}
        </div>
      </div>

      <BulkEnrollModal
        courseId={courseId}
        isOpen={showBulkEnroll}
        onClose={() => setShowBulkEnroll(false)}
      />
    </div>
  );
}
