import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { QuestionAnalytics } from '../../features/staff-grading/components/QuestionAnalytics';
import { apiClient } from '../../lib/api';
import {
  ChartBarIcon,
  ArrowLeftIcon,
  ChevronUpDownIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

export const Route = createFileRoute('/staff/assignment-analytics')({
  component: AssignmentAnalyticsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    assignmentId: (search.assignmentId as string) || '',
  }),
});

type AssignmentOption = {
  id: string;
  title: string;
  courseCode: string;
  courseName: string;
};

function AssignmentAnalyticsPage() {
  const { assignmentId } = Route.useSearch();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const data = await apiClient<Array<{
          id: string;
          title: string;
          courseCode: string;
          courseName: string;
        }>>('/api/auto-grade/assignments');
        setAssignments(data);
      } catch {
        // Assignments list is optional context
      } finally {
        setLoading(false);
      }
    };

    void fetchAssignments();
  }, []);

  const selectedAssignment = assignments.find((a) => a.id === assignmentId);

  const handleSelect = (id: string) => {
    setDropdownOpen(false);
    navigate({
      to: '/staff/assignment-analytics',
      search: { assignmentId: id },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate({ to: '/staff/analytics' })}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
            </button>
            <ChartBarIcon className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Assignment Analytics
              </h1>
              <p className="text-sm text-gray-600">
                Per-question performance metrics and score distributions
              </p>
            </div>
          </div>
        </div>

        {/* Assignment Picker */}
        <div className="mt-4 relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full md:w-96 flex items-center justify-between px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
          >
            <span className={`text-sm ${selectedAssignment ? 'text-gray-900' : 'text-gray-500'}`}>
              {selectedAssignment
                ? `${selectedAssignment.courseCode} — ${selectedAssignment.title}`
                : 'Select an assignment...'}
            </span>
            <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute z-10 mt-1 w-full md:w-96 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-sm text-gray-500">Loading assignments...</div>
              ) : assignments.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">No assignments found</div>
              ) : (
                assignments.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => handleSelect(a.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left ${
                      a.id === assignmentId ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {a.title}
                      </div>
                      <div className="text-xs text-gray-500">
                        {a.courseCode} — {a.courseName}
                      </div>
                    </div>
                    {a.id === assignmentId && (
                      <CheckIcon className="h-5 w-5 text-blue-600" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Analytics Content */}
      {assignmentId ? (
        <QuestionAnalytics assignmentId={assignmentId} />
      ) : (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <ChartBarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            Select an Assignment
          </h3>
          <p className="text-sm text-gray-500">
            Choose an assignment above to view per-question grading analytics.
          </p>
        </div>
      )}
    </div>
  );
}
