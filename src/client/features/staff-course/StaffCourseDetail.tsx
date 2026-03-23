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
import { coursesApi, questionsApi } from '../../lib/api';
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; duplicates: number; errors?: Array<{ row: number; error: string }> } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const queryClient = useQueryClient();

  const { course, assignments, questions, tags, enrollments, loading } = useStaffCourse(courseId, user, dbUser);
  const assignmentForm = useAssignmentForm(courseId);
  const questionForm = useQuestionForm(courseId);

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
      if (!user && !dbUser) {
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
      {questionForm.toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-md px-4 py-3 shadow-lg text-white ${
            questionForm.toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {questionForm.toast.message}
        </div>
      )}
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
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => assignmentForm.setShowForm(true)}
                    disabled={questions.length === 0}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-500"
                  >
                    Create Assignment
                  </button>
                  {questions.length === 0 && (
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      Add questions to the Question Pool first
                    </div>
                  )}
                </div>
              </div>

              <Modal
                isOpen={assignmentForm.showForm}
                onClose={() => assignmentForm.setShowForm(false)}
                title="Create Assignment"
                size="screen"
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
                    onClone={assignmentForm.cloneAssignment}
                    isCloning={assignmentForm.isCloning}
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
                    onClick={async () => {
                      try {
                        const data = await questionsApi.exportQuestions(courseId, 'json');
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `questions-export-${course?.code || courseId}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        alert('Export failed: ' + (err instanceof Error ? err.message : String(err)));
                      }
                    }}
                    className="border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded"
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowImportModal(true); setImportResult(null); }}
                    className="border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-2 px-4 rounded"
                  >
                    Import
                  </button>
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
                size="screen"
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

              <Modal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                title="Import Questions"
                size="md"
              >
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Upload a CSV or JSON file to import questions into this course. Duplicate questions (matching type, title, and content) will be skipped.
                  </p>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs font-medium text-gray-700 mb-2">CSV format columns:</p>
                    <code className="text-xs text-gray-600 block">type, title, content, tags, points, description</code>
                    <p className="text-xs text-gray-500 mt-1">Content: JSON string. Tags: semicolon-separated.</p>
                  </div>
                  <input
                    type="file"
                    accept=".csv,.json"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsImporting(true);
                      setImportResult(null);
                      try {
                        const result = await questionsApi.importQuestions(courseId, file);
                        setImportResult(result);
                        queryClient.invalidateQueries({ queryKey: ['questions', courseId] });
                      } catch (err) {
                        alert('Import failed: ' + (err instanceof Error ? err.message : String(err)));
                      } finally {
                        setIsImporting(false);
                        e.target.value = '';
                      }
                    }}
                    disabled={isImporting}
                    className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                  />
                  {isImporting && <p className="text-sm text-blue-600">Importing...</p>}
                  {importResult && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
                      <p className="font-medium text-green-800">
                        Import complete: {importResult.imported} imported, {importResult.duplicates} duplicates skipped.
                      </p>
                      {importResult.errors && importResult.errors.length > 0 && (
                        <div className="mt-2">
                          <p className="font-medium text-amber-700">Validation errors:</p>
                          <ul className="list-disc list-inside text-xs text-amber-600 mt-1">
                            {importResult.errors.slice(0, 10).map((err, i) => (
                              <li key={i}>Row {err.row}: {err.error}</li>
                            ))}
                            {importResult.errors.length > 10 && (
                              <li>...and {importResult.errors.length - 10} more</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowImportModal(false)}
                      className="rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </Modal>
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
