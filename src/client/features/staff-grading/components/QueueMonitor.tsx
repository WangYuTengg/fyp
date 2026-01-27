import { useEffect, useState } from 'react';
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  QueueListIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

type QueueStatus = {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  avgProcessingTimeMs: number;
  estimatedCompletionMs: number;
  queueDepth: number;
};

export function QueueMonitor() {
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQueueStatus();
    // Refresh every 5 seconds
    const interval = setInterval(fetchQueueStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchQueueStatus = async () => {
    try {
      const response = await fetch('/api/auto-grade/queue');
      if (!response.ok) {
        throw new Error('Failed to fetch queue status');
      }
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-600">Error loading queue status: {error}</div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  // Calculate success rate
  const totalProcessed = status.completed + status.failed;
  const successRate = totalProcessed > 0 ? (status.completed / totalProcessed) * 100 : 100;

  // Warning conditions
  const highQueueDepth = status.queueDepth > 100;
  const lowSuccessRate = successRate < 90 && totalProcessed > 10;

  // Format estimated completion time
  const formatEstimatedTime = (ms: number) => {
    if (ms < 60000) {
      return `${Math.round(ms / 1000)}s`;
    } else if (ms < 3600000) {
      return `${Math.round(ms / 60000)}m`;
    } else {
      return `${Math.round(ms / 3600000)}h ${Math.round((ms % 3600000) / 60000)}m`;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Job Queue Status</h3>
          <span className="text-xs text-gray-500">Updates every 5s</span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Warning Banners */}
        {(highQueueDepth || lowSuccessRate) && (
          <div className="space-y-2">
            {highQueueDepth && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex items-start">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-yellow-800">
                      High Queue Depth Detected
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Queue has {status.queueDepth} pending jobs. Consider increasing worker concurrency or checking for stuck jobs.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {lowSuccessRate && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4">
                <div className="flex items-start">
                  <XCircleIcon className="h-5 w-5 text-red-400 mt-0.5" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">
                      Low Success Rate: {successRate.toFixed(1)}%
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      Check notifications for error details. Common issues: missing model answers, API rate limits, or invalid questions.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Queue Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <QueueListIcon className="h-8 w-8 text-yellow-600" />
              <div>
                <div className="text-xs text-yellow-600 font-medium uppercase">Pending</div>
                <div className="text-2xl font-bold text-yellow-900">{status.pending}</div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <ClockIcon className="h-8 w-8 text-blue-600 animate-pulse" />
              <div>
                <div className="text-xs text-blue-600 font-medium uppercase">Processing</div>
                <div className="text-2xl font-bold text-blue-900">{status.processing}</div>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
              <div>
                <div className="text-xs text-green-600 font-medium uppercase">Completed</div>
                <div className="text-2xl font-bold text-green-900">{status.completed}</div>
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <XCircleIcon className="h-8 w-8 text-red-600" />
              <div>
                <div className="text-xs text-red-600 font-medium uppercase">Failed</div>
                <div className="text-2xl font-bold text-red-900">{status.failed}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Queue Details */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total Jobs</span>
            <span className="font-semibold text-gray-900">{status.total}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Queue Depth</span>
            <span className={`font-semibold ${highQueueDepth ? 'text-yellow-600' : 'text-gray-900'}`}>
              {status.queueDepth}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Avg Processing Time</span>
            <span className="font-semibold text-gray-900">
              {(status.avgProcessingTimeMs / 1000).toFixed(2)}s
            </span>
          </div>
          {status.pending > 0 && (
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-sm text-gray-600">Estimated Completion</span>
              <span className="font-semibold text-blue-600">
                {formatEstimatedTime(status.estimatedCompletionMs)}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="text-sm text-gray-600">Success Rate</span>
            <span className={`font-semibold ${lowSuccessRate ? 'text-red-600' : 'text-green-600'}`}>
              {successRate.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Active Jobs Indicator */}
        {status.processing > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
            <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse"></div>
            <span>{status.processing} job{status.processing !== 1 ? 's' : ''} currently processing...</span>
          </div>
        )}
      </div>
    </div>
  );
}
