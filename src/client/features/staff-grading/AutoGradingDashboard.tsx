import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { AssignmentAutoGradingList } from './AssignmentAutoGradingList';

export function AutoGradingDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <Cog6ToothIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Auto-Grading Dashboard</h1>
        </div>
        <p className="text-sm text-gray-600">
          AI-powered automatic grading for written and UML diagram questions
        </p>
      </div>

      {/* Assignment List with Grading Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Published Assignments</h2>
        <AssignmentAutoGradingList />
      </div>
    </div>
  );
}
