import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { AssignmentAutoGradingList } from './AssignmentAutoGradingList';

type AutoGradingDashboardProps = {
  courseId?: string;
  courseCode?: string;
};

export function AutoGradingDashboard({ courseId, courseCode }: AutoGradingDashboardProps) {
  const title = courseCode
    ? `Auto-Grading Dashboard - ${courseCode}`
    : 'Auto-Grading Dashboard';

  const description = courseId
    ? 'AI-powered automatic grading for assignments in this course'
    : 'AI-powered automatic grading for written and UML diagram questions';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <Cog6ToothIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        </div>
        <p className="text-sm text-gray-600">{description}</p>
      </div>

      {/* Assignment List with Grading Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Published Assignments</h2>
        <AssignmentAutoGradingList courseId={courseId} />
      </div>
    </div>
  );
}
