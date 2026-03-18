import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  AcademicCapIcon,
  CpuChipIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '../../../lib/api';

type QuestionMetrics = {
  questionId: string;
  questionTitle: string;
  questionType: 'mcq' | 'written' | 'coding' | 'uml';
  maxPoints: number;
  order: number;
  totalGraded: number;
  avgScore: number;
  medianScore: number;
  stdDeviation: number;
  minScore: number;
  maxScore: number;
  q1: number;
  q3: number;
  scoreDistribution: Array<{ bucket: string; count: number }>;
  aboveThreshold: number;
  belowThreshold: number;
  thresholdPercent: number;
  aiOverrideRate: number;
  aiAssistedCount: number;
  aiOverriddenCount: number;
};

type AnalyticsData = {
  assignmentId: string;
  assignmentTitle: string;
  totalSubmissions: number;
  gradedSubmissions: number;
  overallAvgScore: number;
  overallMedianScore: number;
  questions: QuestionMetrics[];
};

type QuestionAnalyticsProps = {
  assignmentId: string;
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: 'MCQ',
  written: 'Written',
  coding: 'Coding',
  uml: 'UML',
};

const SCORE_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#3b82f6',
];

export function QuestionAnalytics({ assignmentId }: QuestionAnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(50);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiClient<AnalyticsData>(
          `/api/assignments/${assignmentId}/analytics?threshold=${threshold}`
        );
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    void fetchAnalytics();
  }, [assignmentId, threshold]);

  const handleExportCsv = () => {
    window.open(`/api/assignments/${assignmentId}/export-grades`, '_blank');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow p-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 text-red-600">
          <ExclamationTriangleIcon className="h-5 w-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const hasData = data.gradedSubmissions > 0;

  return (
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <ChartBarIcon className="h-6 w-6 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Question Analytics
            </h2>
          </div>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export Grades CSV
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Submissions"
            value={data.totalSubmissions}
            color="blue"
          />
          <StatCard
            label="Graded"
            value={data.gradedSubmissions}
            color="green"
          />
          <StatCard
            label="Avg Score"
            value={hasData ? data.overallAvgScore.toFixed(1) : '-'}
            color="purple"
          />
          <StatCard
            label="Median Score"
            value={hasData ? data.overallMedianScore.toFixed(1) : '-'}
            color="indigo"
          />
        </div>
      </div>

      {/* Threshold Control */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">
            Pass Threshold:
          </label>
          <div className="flex gap-2">
            {[40, 50, 60, 70, 80].map((t) => (
              <button
                key={t}
                onClick={() => setThreshold(t)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  threshold === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Per-Question Comparison Chart */}
      {hasData && data.questions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Average Score by Question
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={data.questions.map((q) => ({
                name: `Q${q.order}`,
                avg: q.avgScore,
                max: q.maxPoints,
                pct: q.maxPoints > 0 ? (q.avgScore / q.maxPoints) * 100 : 0,
              }))}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis label={{ value: 'Avg %', angle: -90, position: 'insideLeft' }} />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Avg Score %']}
              />
              <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                {data.questions.map((q) => {
                  const pct = q.maxPoints > 0 ? (q.avgScore / q.maxPoints) * 100 : 0;
                  return (
                    <Cell
                      key={q.questionId}
                      fill={pct >= threshold ? '#22c55e' : pct >= threshold * 0.7 ? '#f59e0b' : '#ef4444'}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-Question Detail Cards */}
      {data.questions.map((q) => (
        <QuestionCard
          key={q.questionId}
          question={q}
          expanded={expandedQuestion === q.questionId}
          onToggle={() =>
            setExpandedQuestion(
              expandedQuestion === q.questionId ? null : q.questionId
            )
          }
        />
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    red: 'bg-red-50 border-red-200 text-red-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  };

  const labelColors: Record<string, string> = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    indigo: 'text-indigo-600',
    red: 'text-red-600',
    yellow: 'text-yellow-600',
  };

  return (
    <div className={`rounded-lg border p-4 ${colors[color] ?? colors.blue}`}>
      <p className={`text-xs font-medium mb-1 ${labelColors[color] ?? labelColors.blue}`}>
        {label}
      </p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function QuestionCard({
  question: q,
  expanded,
  onToggle,
}: {
  question: QuestionMetrics;
  expanded: boolean;
  onToggle: () => void;
}) {
  const scorePct = q.maxPoints > 0 ? (q.avgScore / q.maxPoints) * 100 : 0;
  const isLow = scorePct < q.thresholdPercent;
  const highOverride = q.aiOverrideRate > 30;

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Question Header */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-gray-500">Q{q.order}</span>
          <span className="text-sm font-medium text-gray-900 truncate max-w-md">
            {q.questionTitle}
          </span>
          <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600">
            {QUESTION_TYPE_LABELS[q.questionType] ?? q.questionType}
          </span>
          {isLow && q.totalGraded > 0 && (
            <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700">
              Low avg
            </span>
          )}
          {highOverride && (
            <span className="px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700">
              High AI override
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Avg: {q.totalGraded > 0 ? `${q.avgScore}/${q.maxPoints}` : '-'}
          </span>
          <span className="text-sm text-gray-500">
            {q.totalGraded} graded
          </span>
          <svg
            className={`h-5 w-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="px-6 pb-6 border-t border-gray-100">
          {q.totalGraded === 0 ? (
            <p className="text-sm text-gray-500 mt-4">
              No graded submissions yet.
            </p>
          ) : (
            <div className="mt-4 space-y-6">
              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <MiniStat label="Avg" value={q.avgScore.toFixed(1)} />
                <MiniStat label="Median" value={q.medianScore.toFixed(1)} />
                <MiniStat label="Std Dev" value={q.stdDeviation.toFixed(1)} />
                <MiniStat label="Min" value={String(q.minScore)} />
                <MiniStat label="Max" value={String(q.maxScore)} />
                <MiniStat label="Q1" value={q.q1.toFixed(1)} />
                <MiniStat label="Q3" value={q.q3.toFixed(1)} />
              </div>

              {/* Threshold and AI Override */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AcademicCapIcon className="h-5 w-5 text-gray-600" />
                    <h4 className="text-sm font-semibold text-gray-700">
                      Pass Rate ({q.thresholdPercent}% threshold)
                    </h4>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-2xl font-bold text-green-600">
                        {q.aboveThreshold}
                      </span>
                      <span className="text-sm text-gray-500 ml-1">passed</span>
                    </div>
                    <div>
                      <span className="text-2xl font-bold text-red-600">
                        {q.belowThreshold}
                      </span>
                      <span className="text-sm text-gray-500 ml-1">below</span>
                    </div>
                    <div className="ml-auto">
                      <span className="text-lg font-semibold text-gray-900">
                        {q.totalGraded > 0
                          ? ((q.aboveThreshold / q.totalGraded) * 100).toFixed(0)
                          : 0}
                        %
                      </span>
                      <span className="text-sm text-gray-500 ml-1">pass rate</span>
                    </div>
                  </div>
                </div>

                {q.aiAssistedCount > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CpuChipIcon className="h-5 w-5 text-gray-600" />
                      <h4 className="text-sm font-semibold text-gray-700">
                        AI Grading
                      </h4>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-2xl font-bold text-blue-600">
                          {q.aiAssistedCount}
                        </span>
                        <span className="text-sm text-gray-500 ml-1">AI graded</span>
                      </div>
                      <div>
                        <span className={`text-2xl font-bold ${q.aiOverrideRate > 30 ? 'text-red-600' : 'text-gray-700'}`}>
                          {q.aiOverrideRate.toFixed(0)}%
                        </span>
                        <span className="text-sm text-gray-500 ml-1">override rate</span>
                      </div>
                    </div>
                    {q.aiOverrideRate > 50 && (
                      <p className="text-xs text-red-600 mt-2">
                        High override rate suggests the rubric or prompt may need improvement.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Score Distribution Chart */}
              {q.scoreDistribution.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    Score Distribution
                  </h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={q.scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="bucket"
                        tick={{ fontSize: 11 }}
                        angle={-30}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {q.scoreDistribution.map((entry, index) => (
                          <Cell
                            key={entry.bucket}
                            fill={SCORE_COLORS[index % SCORE_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Box Plot (text-based summary) */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Score Spread (out of {q.maxPoints})
                </h4>
                <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
                  {/* IQR range */}
                  <div
                    className="absolute top-0 h-full bg-blue-200 rounded"
                    style={{
                      left: `${(q.q1 / q.maxPoints) * 100}%`,
                      width: `${((q.q3 - q.q1) / q.maxPoints) * 100}%`,
                    }}
                  />
                  {/* Median line */}
                  <div
                    className="absolute top-0 h-full w-0.5 bg-blue-700"
                    style={{
                      left: `${(q.medianScore / q.maxPoints) * 100}%`,
                    }}
                  />
                  {/* Min marker */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-gray-500"
                    style={{ left: `${(q.minScore / q.maxPoints) * 100}%` }}
                  />
                  {/* Max marker */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-gray-500"
                    style={{ left: `${(q.maxScore / q.maxPoints) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Min: {q.minScore}</span>
                  <span>Q1: {q.q1.toFixed(1)}</span>
                  <span>Median: {q.medianScore.toFixed(1)}</span>
                  <span>Q3: {q.q3.toFixed(1)}</span>
                  <span>Max: {q.maxScore}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center bg-gray-50 rounded-lg p-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}
