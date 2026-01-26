import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useGrading } from './hooks/useGrading';
import { SubmissionList } from './components/SubmissionList';
import { GradingPanel } from './components/GradingPanel';

type SearchParams = {
  assignmentId: string;
  submissionId?: string;
};

export function StaffGrading() {
  const { user, dbUser, loading: authLoading, setAdminViewAs } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as SearchParams;
  const { assignmentId, submissionId } = search;

  const {
    assignment,
    submissions,
    selectedSubmission,
    loading,
    error,
    selectSubmission,
    submitGrade,
    isSubmitting,
  } = useGrading(assignmentId, submissionId);

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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        Error: {error}
      </div>
    );
  }

  if (!assignment) {
    return <div className="text-center py-8">Assignment not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
            <p className="mt-1 text-sm text-gray-600">Grading Interface</p>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: `/staff/courses/${assignment.courseId}` })}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to Course
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Submissions List */}
        <div className="lg:col-span-1">
          <SubmissionList
            submissions={submissions}
            selectedSubmissionId={selectedSubmission?.id}
            onSelectSubmission={selectSubmission}
          />
        </div>

        {/* Grading Panel */}
        <div className="lg:col-span-2">
          {selectedSubmission ? (
            <GradingPanel
              submission={selectedSubmission}
              assignment={assignment}
              onSubmitGrade={submitGrade}
              isSubmitting={isSubmitting}
            />
          ) : (
            <div className="bg-white shadow rounded-lg p-6">
              <p className="text-gray-500 text-center">
                Select a submission from the list to start grading
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
