import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '../../../lib/api';
import {
  CheckCircleIcon,
  ClockIcon,
  DocumentArrowDownIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

type ReceiptData = {
  id: string;
  assignmentId: string;
  attemptNumber: number;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  autoSubmitted: boolean;
  latePenaltyApplied: string | null;
  answers: Array<{
    id: string;
    questionId: string;
    content: Record<string, unknown>;
  }>;
  assignment?: {
    title: string;
    questionCount: number;
  };
  totalQuestions: number;
};

type SubmissionReceiptProps = {
  submissionId: string;
};

export function SubmissionReceipt({ submissionId }: SubmissionReceiptProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        setLoading(true);
        const data = await apiClient<ReceiptData>(`/api/submissions/${submissionId}`);
        setReceipt(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load submission receipt');
      } finally {
        setLoading(false);
      }
    };

    void fetchReceipt();
  }, [submissionId]);

  if (loading) {
    return <div className="text-center py-8">Loading receipt...</div>;
  }

  if (error || !receipt) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error ?? 'Submission not found'}
      </div>
    );
  }

  const isLate = receipt.status === 'late';
  const submittedAt = receipt.submittedAt ? new Date(receipt.submittedAt) : null;
  const answeredCount = receipt.answers?.length ?? 0;
  const totalQuestions = receipt.totalQuestions ?? receipt.assignment?.questionCount ?? answeredCount;

  const formatDate = (date: Date) =>
    date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const generateReceiptText = () => {
    const lines = [
      '========================================',
      '       SUBMISSION RECEIPT',
      '========================================',
      '',
      `Assignment:     ${receipt.assignment?.title ?? 'N/A'}`,
      `Submission ID:  ${receipt.id}`,
      `Attempt:        #${receipt.attemptNumber}`,
      `Status:         ${isLate ? 'Late' : 'Submitted'}`,
      `Submitted at:   ${submittedAt ? formatDate(submittedAt) : 'N/A'}`,
      `Questions:      ${answeredCount} answered / ${totalQuestions} total`,
      '',
    ];

    if (receipt.autoSubmitted) {
      lines.push('Note: This submission was auto-submitted.');
      lines.push('');
    }

    if (isLate && receipt.latePenaltyApplied) {
      lines.push(`Late penalty:   ${receipt.latePenaltyApplied}%`);
      lines.push('');
    }

    lines.push('----------------------------------------');
    lines.push('Keep this receipt for your records.');
    lines.push(`Generated: ${formatDate(new Date())}`);
    lines.push('========================================');

    return lines.join('\n');
  };

  const handleDownload = () => {
    const text = generateReceiptText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `submission-receipt-${receipt.id.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Success banner */}
      <div className={`rounded-lg p-4 flex items-center gap-3 ${isLate ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
        {isLate ? (
          <ClockIcon className="h-6 w-6 text-amber-600 flex-shrink-0" />
        ) : (
          <CheckCircleIcon className="h-6 w-6 text-green-600 flex-shrink-0" />
        )}
        <div>
          <h2 className={`text-lg font-semibold ${isLate ? 'text-amber-800' : 'text-green-800'}`}>
            {isLate ? 'Submission received (late)' : 'Submission received'}
          </h2>
          <p className={`text-sm ${isLate ? 'text-amber-700' : 'text-green-700'}`}>
            Your assignment has been submitted successfully.
          </p>
        </div>
      </div>

      {/* Receipt details */}
      <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
        <div className="px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {receipt.assignment?.title ?? 'Assignment'}
          </h3>
        </div>

        <dl className="divide-y divide-gray-100">
          <div className="px-6 py-3 flex justify-between">
            <dt className="text-sm font-medium text-gray-500">Submission ID</dt>
            <dd className="text-sm text-gray-900 font-mono">{receipt.id.slice(0, 8)}</dd>
          </div>

          <div className="px-6 py-3 flex justify-between">
            <dt className="text-sm font-medium text-gray-500">Attempt</dt>
            <dd className="text-sm text-gray-900">#{receipt.attemptNumber}</dd>
          </div>

          <div className="px-6 py-3 flex justify-between">
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                isLate
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-green-100 text-green-800'
              }`}>
                {isLate ? 'Late' : 'Submitted'}
              </span>
            </dd>
          </div>

          <div className="px-6 py-3 flex justify-between">
            <dt className="text-sm font-medium text-gray-500">Submitted at</dt>
            <dd className="text-sm text-gray-900">
              {submittedAt ? formatDate(submittedAt) : 'N/A'}
            </dd>
          </div>

          <div className="px-6 py-3 flex justify-between">
            <dt className="text-sm font-medium text-gray-500">Questions answered</dt>
            <dd className="text-sm text-gray-900">
              {answeredCount} / {totalQuestions}
            </dd>
          </div>

          {receipt.autoSubmitted && (
            <div className="px-6 py-3 flex justify-between">
              <dt className="text-sm font-medium text-gray-500">Auto-submitted</dt>
              <dd className="text-sm text-gray-900">Yes (time limit or tab switch)</dd>
            </div>
          )}

          {isLate && receipt.latePenaltyApplied && (
            <div className="px-6 py-3 flex justify-between">
              <dt className="text-sm font-medium text-gray-500">Late penalty</dt>
              <dd className="text-sm text-amber-700 font-medium">{receipt.latePenaltyApplied}%</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate({ to: '/student' })}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to dashboard
        </button>

        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <DocumentArrowDownIcon className="h-4 w-4" />
          Download Receipt
        </button>
      </div>
    </div>
  );
}
