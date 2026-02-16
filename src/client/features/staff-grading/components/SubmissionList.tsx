import { useState } from 'react';
import type { GradingSubmission } from '../types';

type SubmissionListProps = {
  submissions: GradingSubmission[];
  filteredSubmissions: GradingSubmission[];
  selectedSubmissionId?: string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSelectSubmission: (submissionId: string) => void;
};

export function SubmissionList({
  submissions,
  filteredSubmissions,
  selectedSubmissionId,
  searchQuery,
  onSearchQueryChange,
  onSelectSubmission,
}: SubmissionListProps) {
  const [jumpTo, setJumpTo] = useState('');

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

  const gradedCount = submissions.filter((submission) => submission.status === 'graded').length;
  const remainingCount = submissions.length - gradedCount;

  const handleJump = () => {
    const index = Number.parseInt(jumpTo, 10);
    if (Number.isNaN(index)) return;

    const clamped = Math.max(1, Math.min(index, filteredSubmissions.length));
    const targetSubmission = filteredSubmissions[clamped - 1];
    if (targetSubmission) {
      onSelectSubmission(targetSubmission.id);
      setJumpTo(String(clamped));
    }
  };

  return (
    <div className="bg-white shadow rounded-lg h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Submissions</h2>
          <span className="text-xs text-gray-500">
            {filteredSubmissions.length} / {submissions.length}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-gray-50 rounded px-2 py-1.5">
            <div className="text-gray-500">Total</div>
            <div className="font-semibold text-gray-900">{submissions.length}</div>
          </div>
          <div className="bg-green-50 rounded px-2 py-1.5">
            <div className="text-green-700">Graded</div>
            <div className="font-semibold text-green-900">{gradedCount}</div>
          </div>
          <div className="bg-blue-50 rounded px-2 py-1.5">
            <div className="text-blue-700">Remaining</div>
            <div className="font-semibold text-blue-900">{remainingCount}</div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Search student</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Name or email"
            className="form-input-block"
          />
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700">Jump to #</label>
            <input
              type="number"
              value={jumpTo}
              min={1}
              max={filteredSubmissions.length || 1}
              onChange={(event) => setJumpTo(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleJump();
                }
              }}
              placeholder="1"
              className="form-input-block"
            />
          </div>
          <button
            type="button"
            onClick={handleJump}
            disabled={filteredSubmissions.length === 0}
            className="mb-0.5 px-3 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Go
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-200 overflow-y-auto flex-1 min-h-[420px]">
        {filteredSubmissions.length === 0 ? (
          <div className="p-4 text-center text-gray-500">No matching submissions</div>
        ) : (
          filteredSubmissions.map((submission, index) => (
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
                    {index + 1}. {submission.user?.fullName || submission.user?.email || 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Attempt {submission.attemptNumber}</p>
                  {submission.submittedAt && (
                    <p className="text-xs text-gray-500">{new Date(submission.submittedAt).toLocaleString()}</p>
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

      <div className="px-4 py-2 border-t border-gray-200 text-xs text-gray-500">
        Shortcuts: J/K for next/previous student.
      </div>
    </div>
  );
}
