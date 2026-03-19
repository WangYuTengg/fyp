import { useNavigate, useSearch, Link } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownTrayIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { downloadFile } from '../../lib/api';
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
  const [searchQuery, setSearchQuery] = useState('');

  const {
    assignment,
    submissions,
    selectedSubmission,
    loading,
    error,
    submitGrade,
    isSubmitting,
  } = useGrading(assignmentId, submissionId);

  const submittedSubmissions = useMemo(
    () => submissions.filter((submissionItem) => submissionItem.status !== 'draft'),
    [submissions]
  );

  const filteredSubmissions = useMemo(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase();
    if (!trimmedQuery) {
      return submittedSubmissions;
    }

    return submittedSubmissions.filter((submissionItem) => {
      const fullName = submissionItem.user?.fullName?.toLowerCase() ?? '';
      const email = submissionItem.user?.email?.toLowerCase() ?? '';
      return fullName.includes(trimmedQuery) || email.includes(trimmedQuery);
    });
  }, [submittedSubmissions, searchQuery]);

  const handleSelectSubmission = useCallback(
    (targetSubmissionId: string) => {
      navigate({
        to: '/staff/grading',
        search: {
          assignmentId,
          submissionId: targetSubmissionId,
        },
      });
    },
    [navigate, assignmentId]
  );

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

  // Auto-select first submission to reduce clicks when opening manual grading.
  useEffect(() => {
    if (selectedSubmission || filteredSubmissions.length === 0) {
      return;
    }

    handleSelectSubmission(filteredSubmissions[0].id);
  }, [filteredSubmissions, handleSelectSubmission, selectedSubmission]);

  const selectedSubmissionIndex = useMemo(() => {
    if (!selectedSubmission) return -1;

    return filteredSubmissions.findIndex((submissionItem) => submissionItem.id === selectedSubmission.id);
  }, [filteredSubmissions, selectedSubmission]);

  const hasPreviousSubmission = selectedSubmissionIndex > 0;
  const hasNextSubmission =
    selectedSubmissionIndex >= 0 && selectedSubmissionIndex < filteredSubmissions.length - 1;

  const handleSelectPreviousSubmission = useCallback(() => {
    if (!hasPreviousSubmission) return;

    const previousSubmission = filteredSubmissions[selectedSubmissionIndex - 1];
    if (previousSubmission) {
      handleSelectSubmission(previousSubmission.id);
    }
  }, [filteredSubmissions, handleSelectSubmission, hasPreviousSubmission, selectedSubmissionIndex]);

  const handleSelectNextSubmission = useCallback(() => {
    if (!hasNextSubmission) return;

    const nextSubmission = filteredSubmissions[selectedSubmissionIndex + 1];
    if (nextSubmission) {
      handleSelectSubmission(nextSubmission.id);
    }
  }, [filteredSubmissions, handleSelectSubmission, hasNextSubmission, selectedSubmissionIndex]);

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
    <div className="space-y-4">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manual Grading Workspace (Question-by-Question)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/staff/assignment-analytics"
              search={{ assignmentId }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <ChartBarIcon className="h-4 w-4" />
              Analytics
            </Link>
            <button
              type="button"
              onClick={() => downloadFile(`/api/assignments/${assignmentId}/export-grades`).catch((err) => alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`))}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: `/staff/courses/${assignment.courseId}` })}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Back to Course
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[350px_minmax(0,1fr)] gap-4">
        <div className="xl:h-[calc(100vh-220px)]">
          <SubmissionList
            submissions={submittedSubmissions}
            filteredSubmissions={filteredSubmissions}
            selectedSubmissionId={selectedSubmission?.id}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onSelectSubmission={handleSelectSubmission}
          />
        </div>

        <div>
          {selectedSubmission ? (
            <GradingPanel
              key={selectedSubmission.id}
              submission={selectedSubmission}
              assignment={assignment}
              onSubmitGrade={submitGrade}
              isSubmitting={isSubmitting}
              hasPreviousSubmission={hasPreviousSubmission}
              hasNextSubmission={hasNextSubmission}
              currentSubmissionIndex={selectedSubmissionIndex}
              totalSubmissionCount={filteredSubmissions.length}
              onSelectPreviousSubmission={handleSelectPreviousSubmission}
              onSelectNextSubmission={handleSelectNextSubmission}
            />
          ) : (
            <div className="bg-white shadow rounded-lg p-6">
              <p className="text-gray-500 text-center">
                Select a submission from the list to start grading.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
