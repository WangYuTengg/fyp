import { useEffect, useState } from 'react';
import { 
  CurrencyDollarIcon, 
  CpuChipIcon, 
  ChartBarIcon,
  ClockIcon 
} from '@heroicons/react/24/outline';
import { apiClient } from '../../../lib/api';

type PeriodFilter = 'week' | 'month' | 'all';

type UsageStats = {
  totalTokens: number;
  totalCost: number;
  successCount: number;
  failureCount: number;
  avgProcessingTime: number | null;
  providerBreakdown: {
    provider: string;
    tokens: number;
    cost: number;
    count: number;
  }[];
};

type CostAnalyticsProps = {
  onEstimate?: (cost: number) => void;
};

export function CostAnalytics({ onEstimate }: CostAnalyticsProps) {
  const [period, setPeriod] = useState<PeriodFilter>('week');
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [period]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<UsageStats>(`/api/auto-grade/stats?period=${period}`);
      setStats(data);
      
      // Pass cost estimate to parent if needed
      if (onEstimate && data.totalCost) {
        onEstimate(data.totalCost);
      }
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const totalJobs = stats.successCount + stats.failureCount;
  const successRate = totalJobs > 0 ? ((stats.successCount / totalJobs) * 100).toFixed(1) : '0';
  const avgCostPerSubmission = totalJobs > 0 ? (stats.totalCost / totalJobs).toFixed(4) : '0.0000';

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Cost & Usage Analytics</h3>
          <div className="flex gap-2">
            {(['week', 'month', 'all'] as PeriodFilter[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <CurrencyDollarIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">Total Cost</div>
                <div className="text-2xl font-bold text-blue-900">${stats.totalCost.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-600 rounded-lg">
                <CpuChipIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-xs text-green-600 font-medium uppercase tracking-wide">Total Tokens</div>
                <div className="text-2xl font-bold text-green-900">{stats.totalTokens.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600 rounded-lg">
                <ChartBarIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-xs text-purple-600 font-medium uppercase tracking-wide">Avg Cost/Job</div>
                <div className="text-2xl font-bold text-purple-900">${avgCostPerSubmission}</div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-600 rounded-lg">
                <ClockIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-xs text-orange-600 font-medium uppercase tracking-wide">Success Rate</div>
                <div className="text-2xl font-bold text-orange-900">{successRate}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Job Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Job Statistics</h4>
            <div className="space-y-2 bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Jobs</span>
                <span className="font-semibold text-gray-900">{totalJobs}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Successful</span>
                <span className="font-semibold text-green-600">{stats.successCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Failed</span>
                <span className="font-semibold text-red-600">{stats.failureCount}</span>
              </div>
              {stats.avgProcessingTime && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-sm text-gray-600">Avg Processing Time</span>
                  <span className="font-semibold text-gray-900">
                    {(stats.avgProcessingTime / 1000).toFixed(2)}s
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Provider Breakdown */}
          {stats.providerBreakdown && stats.providerBreakdown.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Provider Breakdown</h4>
              <div className="space-y-2">
                {stats.providerBreakdown.map((provider) => (
                  <div
                    key={provider.provider}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{provider.provider}</span>
                      <span className="text-xs text-gray-500">{provider.count} jobs</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-gray-500">Tokens</div>
                        <div className="font-semibold text-gray-900">
                          {provider.tokens.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Cost</div>
                        <div className="font-semibold text-gray-900">
                          ${provider.cost.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Cost Projections */}
        {period !== 'all' && totalJobs > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-yellow-800 mb-2">💡 Cost Projection</h4>
            <p className="text-sm text-yellow-700">
              At the current rate of <strong>${avgCostPerSubmission}/job</strong>, grading 100 submissions 
              would cost approximately <strong>${(parseFloat(avgCostPerSubmission) * 100).toFixed(2)}</strong>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
