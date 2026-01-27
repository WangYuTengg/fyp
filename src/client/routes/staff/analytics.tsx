import { createFileRoute } from '@tanstack/react-router';
import { AnalyticsTab } from '../../features/staff-grading/components/AnalyticsTab';
import { ChartBarIcon } from '@heroicons/react/24/outline';

export const Route = createFileRoute('/staff/analytics')({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <ChartBarIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        </div>
        <p className="text-sm text-gray-600">
          View usage statistics, costs, and queue monitoring
        </p>
      </div>

      {/* Analytics Content */}
      <AnalyticsTab />
    </div>
  );
}
