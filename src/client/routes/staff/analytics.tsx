import { createFileRoute, Link } from '@tanstack/react-router';
import { AnalyticsTab } from '../../features/staff-grading/components/AnalyticsTab';
import {
  ChartBarIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';

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

        {/* Quick Links */}
        <div className="mt-4 flex gap-3">
          <Link
            to="/staff/assignment-analytics"
            search={{ assignmentId: '' }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium border border-blue-200"
          >
            <AcademicCapIcon className="h-4 w-4" />
            Question Analytics
          </Link>
        </div>
      </div>

      {/* Analytics Content */}
      <AnalyticsTab />
    </div>
  );
}
