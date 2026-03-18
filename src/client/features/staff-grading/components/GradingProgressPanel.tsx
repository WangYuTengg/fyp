import { useCallback, useEffect, useState } from 'react';
import { assignmentsApi } from '../../../lib/api';
import {
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

type GradingProgress = {
  assignment: {
    id: string;
    title: string;
    resultsPublished: boolean;
    resultsPublishedAt: string | null;
  };
  summary: {
    totalSubmissions: number;
    gradedSubmissions: number;
    pendingSubmissions: number;
  };
  questionStats: Array<{
    questionId: string;
    questionTitle: string;
    questionType: string;
    maxPoints: number;
    totalAnswers: number;
    gradedAnswers: number;
    avgScore: number;
    aiGradedCount: number;
    aiAcceptedCount: number;
    overrideCount: number;
  }>;
  gradeDistribution: {
    mean: number;
    median: number;
    passCount: number;
    failCount: number;
    scores: number[];
  };
};

type GradingProgressPanelProps = {
  assignmentId: string;
  onNavigateToGrading: () => void;
  onPublishResults: (publish: boolean) => void;
};

export function GradingProgressPanel({
  assignmentId,
  onNavigateToGrading,
  onPublishResults,
}: GradingProgressPanelProps) {
  const [progress, setProgress] = useState<GradingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishLoading, setPublishLoading] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  const loadProgress = useCallback(async () => {
    try {
      setLoading(true);
      const data = await assignmentsApi.getGradingProgress(assignmentId);
      setProgress(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load progress');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  const handlePublish = async (publish: boolean) => {
    try {
      setPublishLoading(true);
      await assignmentsApi.publishResults(assignmentId, publish);
      onPublishResults(publish);
      setShowPublishConfirm(false);
      void loadProgress();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to publish results');
    } finally {
      setPublishLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-8 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (error || !progress) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error || 'Failed to load progress'}
      </div>
    );
  }

  const { summary, questionStats, gradeDistribution, assignment } = progress;
  const completionPercent =
    summary.totalSubmissions > 0
      ? Math.round((summary.gradedSubmissions / summary.totalSubmissions) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Grading Progress</h3>

        {/* Stacked progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>{summary.gradedSubmissions} of {summary.totalSubmissions} graded</span>
            <span>{completionPercent}%</span>
          </div>
          <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <CheckCircleIcon className="h-5 w-5 text-green-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-green-700">{summary.gradedSubmissions}</div>
            <div className="text-xs text-green-600">Graded</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
            <ClockIcon className="h-5 w-5 text-amber-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-amber-700">{summary.pendingSubmissions}</div>
            <div className="text-xs text-amber-600">Pending</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
            <ChartBarIcon className="h-5 w-5 text-blue-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-blue-700">{summary.totalSubmissions}</div>
            <div className="text-xs text-blue-600">Total</div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-4 flex gap-3">
          {summary.pendingSubmissions > 0 ? (
            <button
              type="button"
              onClick={onNavigateToGrading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Grade Remaining ({summary.pendingSubmissions})
            </button>
          ) : null}
          {!assignment.resultsPublished && summary.gradedSubmissions > 0 ? (
            <button
              type="button"
              onClick={() => setShowPublishConfirm(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
            >
              Publish Results
            </button>
          ) : null}
          {assignment.resultsPublished ? (
            <button
              type="button"
              onClick={() => void handlePublish(false)}
              disabled={publishLoading}
              className="px-4 py-2 border border-amber-300 text-amber-700 rounded-md hover:bg-amber-50 text-sm font-medium disabled:opacity-50"
            >
              {publishLoading ? 'Unpublishing...' : 'Unpublish Results'}
            </button>
          ) : null}
        </div>

        {assignment.resultsPublished ? (
          <div className="mt-3 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">
            Results published
            {assignment.resultsPublishedAt
              ? ` on ${new Date(assignment.resultsPublishedAt).toLocaleString()}`
              : ''}
          </div>
        ) : null}
      </div>

      {/* Per-question breakdown */}
      {questionStats.length > 0 ? (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Per-Question Stats</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 pr-4 font-medium text-gray-600">Question</th>
                  <th className="text-left py-2 pr-4 font-medium text-gray-600">Type</th>
                  <th className="text-right py-2 pr-4 font-medium text-gray-600">Graded</th>
                  <th className="text-right py-2 pr-4 font-medium text-gray-600">Avg Score</th>
                  <th className="text-right py-2 pr-4 font-medium text-gray-600">AI Graded</th>
                  <th className="text-right py-2 font-medium text-gray-600">Overrides</th>
                </tr>
              </thead>
              <tbody>
                {questionStats.map((q) => (
                  <tr key={q.questionId} className="border-b border-gray-100">
                    <td className="py-2 pr-4 text-gray-900 max-w-48 truncate">{q.questionTitle}</td>
                    <td className="py-2 pr-4">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 uppercase">
                        {q.questionType}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-700">
                      {q.gradedAnswers}/{q.totalAnswers}
                    </td>
                    <td className="py-2 pr-4 text-right font-medium text-gray-900">
                      {Number(q.avgScore).toFixed(1)}/{q.maxPoints}
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-700">
                      {q.aiAcceptedCount}/{q.aiGradedCount}
                    </td>
                    <td className="py-2 text-right">
                      {q.overrideCount > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <ExclamationTriangleIcon className="h-3.5 w-3.5" />
                          {q.overrideCount}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Grade distribution (pre-publish summary) */}
      {gradeDistribution.scores.length > 0 ? (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Grade Distribution</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{gradeDistribution.mean}%</div>
              <div className="text-xs text-gray-500">Mean</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{gradeDistribution.median}%</div>
              <div className="text-xs text-gray-500">Median</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{gradeDistribution.passCount}</div>
              <div className="text-xs text-gray-500">Pass (&ge;50%)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{gradeDistribution.failCount}</div>
              <div className="text-xs text-gray-500">Fail (&lt;50%)</div>
            </div>
          </div>

          {/* Simple histogram */}
          <GradeHistogram scores={gradeDistribution.scores} />
        </div>
      ) : null}

      {/* Publish confirmation modal */}
      {showPublishConfirm ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Publish Results?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Students will be able to see their grades and feedback. You can unpublish later if needed.
            </p>
            {gradeDistribution.scores.length > 0 ? (
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>Mean: <strong>{gradeDistribution.mean}%</strong></div>
                  <div>Median: <strong>{gradeDistribution.median}%</strong></div>
                  <div>Pass: <strong className="text-green-600">{gradeDistribution.passCount}</strong></div>
                  <div>Fail: <strong className="text-red-600">{gradeDistribution.failCount}</strong></div>
                </div>
              </div>
            ) : null}
            {summary.pendingSubmissions > 0 ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded text-sm mb-4">
                {summary.pendingSubmissions} submission{summary.pendingSubmissions > 1 ? 's' : ''} still pending grading.
              </div>
            ) : null}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPublishConfirm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handlePublish(true)}
                disabled={publishLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium disabled:opacity-50"
              >
                {publishLoading ? 'Publishing...' : 'Publish Results'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GradeHistogram({ scores }: { scores: number[] }) {
  const buckets = Array.from({ length: 10 }, (_, i) => {
    const min = i * 10;
    const max = min + 10;
    const count = scores.filter((s) => (i === 9 ? s >= min && s <= max : s >= min && s < max)).length;
    return { label: `${min}-${max}%`, count };
  });

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  return (
    <div className="flex items-end gap-1 h-24">
      {buckets.map((bucket) => (
        <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-blue-400 rounded-t min-h-[2px] transition-all"
            style={{ height: `${(bucket.count / maxCount) * 100}%` }}
            title={`${bucket.label}: ${bucket.count} students`}
          />
          <div className="text-[9px] text-gray-400 truncate w-full text-center">{bucket.label.split('-')[0]}</div>
        </div>
      ))}
    </div>
  );
}
