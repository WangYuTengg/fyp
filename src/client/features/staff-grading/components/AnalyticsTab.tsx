import { CostAnalytics } from './CostAnalytics';
import { QueueMonitor } from './QueueMonitor';

export function AnalyticsTab() {
  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Grading Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-600 font-medium mb-1">Auto-graded</p>
            <p className="text-3xl font-bold text-green-900">0</p>
            <p className="text-xs text-green-700 mt-1">submissions this week</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-600 font-medium mb-1">Pending Review</p>
            <p className="text-3xl font-bold text-yellow-900">0</p>
            <p className="text-xs text-yellow-700 mt-1">submissions waiting</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-600 font-medium mb-1">Total Graded</p>
            <p className="text-3xl font-bold text-blue-900">0</p>
            <p className="text-xs text-blue-700 mt-1">all time</p>
          </div>
        </div>
      </div>

      {/* Queue Monitor */}
      <QueueMonitor />

      {/* Cost & Usage Analytics */}
      <CostAnalytics />
    </div>
  );
}
