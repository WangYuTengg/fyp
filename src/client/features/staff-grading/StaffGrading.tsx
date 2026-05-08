import { useNavigate, useSearch, Link, Outlet, useChildMatches } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownTrayIcon, ChartBarIcon, CheckCircleIcon, EyeIcon } from '@heroicons/react/24/outline';
import { assignmentsApi, downloadFile } from '../../lib/api';
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

  // When a child route (e.g. /staff/grading/review) is matched, defer entirely
  // to its component via <Outlet />. Without this, this component's auto-select
  // effect below would race the child render and redirect the URL back here.
  const isOnChildRoute = useChildMatches().length > 0;

  const {
    assignment,
    submissions,
    selectedSubmission,
    loading,
    error,
    submitGrade,
    isSubmitting,
    refetch,
  } = useGrading(assignmentId, submissionId);

  // Refetch when returning from a child route (e.g. /staff/grading/review's bulk-accept
  // flips submission statuses to 'graded' on the server but our submissions list is stale).
  const wasOnChildRoute = useRef(isOnChildRoute);
  useEffect(() => {
    if (wasOnChildRoute.current && !isOnChildRoute) {
      void refetch();
    }
    wasOnChildRoute.current = isOnChildRoute;
  }, [isOnChildRoute, refetch]);

  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const handleTogglePublish = useCallback(async (publish: boolean) => {
    if (!assignmentId) return;
    setPublishLoading(true);
    setPublishError(null);
    try {
      await assignmentsApi.publishResults(assignmentId, publish);
      await refetch();
      setPublishConfirmOpen(false);
    } catch (err: unknown) {
      setPublishError(err instanceof Error ? err.message : 'Failed to update results visibility');
    } finally {
      setPublishLoading(false);
    }
  }, [assignmentId, refetch]);

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
      if (!user && !dbUser) {
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
    if (isOnChildRoute) return;
    if (selectedSubmission || filteredSubmissions.length === 0) {
      return;
    }

    handleSelectSubmission(filteredSubmissions[0].id);
  }, [filteredSubmissions, handleSelectSubmission, selectedSubmission, isOnChildRoute]);

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

  if (isOnChildRoute) {
    return <Outlet />;
  }

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

  const gradedCount = submittedSubmissions.filter((s) => s.status === 'graded').length;
  const ungradedCount = submittedSubmissions.length - gradedCount;
  const isPublished = Boolean(assignment.resultsPublished);

  return (
    <div className="space-y-4">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manual Grading Workspace (Question-by-Question)
            </p>
            {isPublished ? (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded">
                <CheckCircleIcon className="h-3.5 w-3.5" />
                Results published
                {assignment.resultsPublishedAt
                  ? ` on ${new Date(assignment.resultsPublishedAt).toLocaleString()}`
                  : ''}
              </div>
            ) : null}
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
            {isPublished ? (
              <button
                type="button"
                onClick={() => void handleTogglePublish(false)}
                disabled={publishLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                <EyeIcon className="h-4 w-4" />
                {publishLoading ? 'Unpublishing...' : 'Unpublish'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPublishConfirmOpen(true)}
                disabled={gradedCount === 0}
                title={gradedCount === 0 ? 'No graded submissions to publish' : 'Make results visible to students'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <EyeIcon className="h-4 w-4" />
                Publish Results
              </button>
            )}
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

      {publishConfirmOpen ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Publish results to students?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Students will be able to see their grades and feedback for this assignment. You can unpublish later.
            </p>
            <div className="bg-gray-50 rounded p-3 mb-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>Graded: <strong className="text-green-700">{gradedCount}</strong></div>
                <div>Ungraded: <strong className="text-amber-700">{ungradedCount}</strong></div>
              </div>
            </div>
            {ungradedCount > 0 ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded text-sm mb-4">
                {ungradedCount} submission{ungradedCount > 1 ? 's' : ''} still ungraded — those students will not see a score yet.
              </div>
            ) : null}
            {publishError ? (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-4">
                {publishError}
              </div>
            ) : null}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPublishConfirmOpen(false)}
                disabled={publishLoading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleTogglePublish(true)}
                disabled={publishLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium disabled:opacity-50"
              >
                {publishLoading ? 'Publishing...' : 'Publish Results'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
