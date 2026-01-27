import type { GradingSubmission } from '../types';

type SubmissionListProps = {
  submissions: GradingSubmission[];
  selectedSubmissionId?: string;
  onSelectSubmission: (submissionId: string) => void;
};

export function SubmissionList({
  submissions,
  selectedSubmissionId,
  onSelectSubmission,
}: SubmissionListProps) {
  const getStatusColor = (status: GradingSubmission['status']) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
      case 'late':
        return 'bg-orange-100 text-orange-800';
      case 'grading':
        return 'bg-yellow-100 text-yellow-800';
      case 'graded':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const submittedSubmissions = submissions.filter((s) => s.status !== 'draft');

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">
          Submissions ({submittedSubmissions.length})
        </h2>
      </div>

      <div className="divide-y divide-gray-200 max-h-[calc(100vh-300px)] overflow-y-auto">
        {submittedSubmissions.length === 0 ? (
          <div className="p-4 text-center text-gray-500">No submissions yet</div>
        ) : (
          submittedSubmissions.map((submission) => (
            <button
              key={submission.id}
              type="button"
              onClick={() => onSelectSubmission(submission.id)}
              className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                selectedSubmissionId === submission.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {submission.user?.fullName || submission.user?.email || 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Attempt {submission.attemptNumber}
                  </p>
                  {submission.submittedAt && (
                    <p className="text-xs text-gray-500">
                      {new Date(submission.submittedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${getStatusColor(
                    submission.status
                  )}`}
                >
                  {submission.status}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
