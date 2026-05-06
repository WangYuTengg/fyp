import { useState, useEffect, Fragment } from 'react';
import { Link } from '@tanstack/react-router';
import { Listbox, Transition } from '@headlessui/react';
import {
  PlayIcon,
  CheckIcon,
  ChevronUpDownIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  SparklesIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { CostEstimateModal } from './components/CostEstimateModal';
import { apiClient } from '../../lib/api';

type Assignment = {
  id: string;
  title: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  dueDate: string | null;
  totalQuestions: number;
  gradableQuestions: number;
  totalSubmissions: number;
  ungradedAnswers: number;
  pendingReview: number;
  missingModelAnswers: string[];
  canAutoGrade: boolean;
};

type CourseOption = {
  id: string;
  name: string;
  code: string;
};

type StatusOption = {
  value: 'all' | 'pending' | 'complete';
  label: string;
};

const statusOptions: StatusOption[] = [
  { value: 'all', label: 'All Assignments' },
  { value: 'pending', label: 'Pending Grading' },
  { value: 'complete', label: 'Fully Graded' },
];

type QueueStatus = {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
};

type AssignmentsResponse = {
  assignments: Assignment[];
};

type BatchResponse = {
  batchId: string;
  queuedCount: number;
};

type AssignmentAutoGradingListProps = {
  courseId?: string;
};

export function AssignmentAutoGradingList({ courseId }: AssignmentAutoGradingListProps) {
  const isCourseScoped = Boolean(courseId);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  // Filters
  const [selectedCourses, setSelectedCourses] = useState<CourseOption[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<StatusOption>(statusOptions[0]);

  // Modal state
  const [showCostModal, setShowCostModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // Poll for batch job completion when active
  useEffect(() => {
    if (!activeBatchId) return;

    const pollInterval = setInterval(async () => {
      try {
        const queueData = await apiClient<QueueStatus>('/api/auto-grade/queue');
        
        // Check if batch is complete (no pending or processing jobs)
        if (queueData.pending === 0 && queueData.processing === 0) {
          // Batch complete, refetch assignments
          await refetchAssignments();
          setActiveBatchId(null);
          
          // Show success notification
          showNotification('Auto-grading batch completed!', 'success');
        }
      } catch (err) {
        console.error('Failed to poll queue status:', err);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBatchId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!isCourseScoped) {
        // Fetch courses for filter in global dashboard mode
        const coursesData = await apiClient<CourseOption[]>('/api/courses');
        setCourses(coursesData || []);
      } else {
        setCourses([]);
      }

      // Fetch assignments
      await refetchAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const refetchAssignments = async () => {
    try {
      const params = new URLSearchParams();

      if (courseId) {
        params.set('courseId', courseId);
      } else if (selectedCourses.length > 0) {
        // For multiple courses, fetch unfiltered data and apply client-side filtering below
        if (selectedCourses.length === 1) {
          params.set('courseId', selectedCourses[0].id);
        }
      }

      // Apply status filter
      if (selectedStatus.value !== 'all') {
        params.set('status', selectedStatus.value);
      }

      const assignmentsData = await apiClient<AssignmentsResponse>(`/api/auto-grade/assignments?${params}`);
      
      let filteredAssignments = assignmentsData.assignments || [];
      
      // Client-side filtering for multiple courses
      if (selectedCourses.length > 1) {
        const courseIds = new Set(selectedCourses.map(c => c.id));
        filteredAssignments = filteredAssignments.filter((a: Assignment) => 
          courseIds.has(a.courseId)
        );
      }
      
      setAssignments(filteredAssignments);
    } catch (err) {
      console.error('Failed to refetch assignments:', err);
    }
  };

  useEffect(() => {
    if (!loading) {
      refetchAssignments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourses, selectedStatus, courseId]);

  const handleRunAutoGrader = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setShowCostModal(true);
  };

  const handleConfirmGrading = async () => {
    if (!selectedAssignment) return;

    try {
      const result = await apiClient<BatchResponse>('/api/auto-grade/batch', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId: selectedAssignment.id,
          questionTypes: ['written', 'uml'],
        }),
      });
      
      // Close modal
      setShowCostModal(false);
      setSelectedAssignment(null);

      // Show success message
      showNotification(
        `Auto-grading started! ${result.queuedCount} jobs queued.`,
        'success'
      );
      
      // Start polling for completion
      setActiveBatchId(result.batchId);

      // Refetch assignments immediately to show updated counts
      setTimeout(refetchAssignments, 1000);
    } catch (err) {
      showNotification(
        err instanceof Error ? err.message : 'Failed to start auto-grading',
        'error'
      );
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    // Simple alert for now - could be replaced with a toast library
    if (type === 'success') {
      alert(`✅ ${message}`);
    } else {
      alert(`❌ ${message}`);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No due date';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading assignments...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className={`grid grid-cols-1 ${isCourseScoped ? '' : 'md:grid-cols-2'} gap-4`}>
          {/* Course Filter (global dashboard only) */}
          {!isCourseScoped && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Course
              </label>
              <Listbox value={selectedCourses} onChange={setSelectedCourses} multiple>
                <div className="relative">
                  <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-white py-2 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <span className="block truncate">
                      {selectedCourses.length === 0
                        ? 'All Courses'
                        : selectedCourses.length === 1
                        ? `${selectedCourses[0].code} - ${selectedCourses[0].name}`
                        : `${selectedCourses.length} courses selected`}
                    </span>
                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                      <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
                    </span>
                  </Listbox.Button>
                  <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                      {courses.map((course) => (
                        <Listbox.Option
                          key={course.id}
                          value={course}
                          className={({ active }: { active: boolean }) =>
                            `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                              active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                            }`
                          }
                        >
                          {({ selected }: { selected: boolean }) => (
                            <>
                              <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                {course.code} - {course.name}
                              </span>
                              {selected && (
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                                  <CheckIcon className="h-5 w-5" />
                                </span>
                              )}
                            </>
                          )}
                        </Listbox.Option>
                      ))}
                    </Listbox.Options>
                  </Transition>
                </div>
              </Listbox>
            </div>
          )}

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Status
            </label>
            <Listbox value={selectedStatus} onChange={setSelectedStatus}>
              <div className="relative">
                <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-white py-2 pl-3 pr-10 text-left border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <span className="block truncate">{selectedStatus.label}</span>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
                  </span>
                </Listbox.Button>
                <Transition
                  as={Fragment}
                  leave="transition ease-in duration-100"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {statusOptions.map((option) => (
                      <Listbox.Option
                        key={option.value}
                        value={option}
                        className={({ active }: { active: boolean }) =>
                          `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                            active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'
                          }`
                        }
                      >
                        {({ selected }: { selected: boolean }) => (
                          <>
                            <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                              {option.label}
                            </span>
                            {selected && (
                              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                                <CheckIcon className="h-5 w-5" />
                              </span>
                            )}
                          </>
                        )}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </Transition>
              </div>
            </Listbox>
          </div>
        </div>
      </div>

      {/* Assignments Table */}
      {assignments.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <InformationCircleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments found</h3>
          <p className="text-gray-600">
            {selectedStatus.value === 'pending'
              ? 'All assignments are fully graded!'
              : selectedStatus.value === 'complete'
              ? 'No fully graded assignments yet.'
              : 'No published assignments available. Create and publish assignments to see them here.'}
          </p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {!isCourseScoped && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Course
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assignment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Questions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submissions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ungraded
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pending Review
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assignments.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-gray-50">
                    {!isCourseScoped && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{assignment.courseCode}</div>
                        <div className="text-sm text-gray-500 truncate" style={{ maxWidth: '150px' }}>
                          {assignment.courseName}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <Link
                        to="/staff/grading"
                        search={{ assignmentId: assignment.id, submissionId: undefined }}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {assignment.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(assignment.dueDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {assignment.gradableQuestions} / {assignment.totalQuestions}
                      <span className="text-gray-500 ml-1">gradable</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {assignment.totalSubmissions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          assignment.ungradedAnswers === 0
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {assignment.ungradedAnswers}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {assignment.pendingReview > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {assignment.pendingReview}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          0
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        {!assignment.canAutoGrade ? (
                          <div className="inline-flex items-center gap-2">
                            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
                            <span className="text-yellow-700 text-xs">
                              {assignment.missingModelAnswers.length} question(s) missing model answers
                            </span>
                          </div>
                        ) : assignment.ungradedAnswers > 0 ? (
                          <button
                            onClick={() => handleRunAutoGrader(assignment)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            <PlayIcon className="h-4 w-4" />
                            Run Auto-Grader
                          </button>
                        ) : null}
                        {assignment.pendingReview > 0 ? (
                          <Link
                            to="/staff/grading/review"
                            search={{ assignmentId: assignment.id, submissionId: undefined }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                          >
                            <SparklesIcon className="h-4 w-4" />
                            Review AI Grades
                          </Link>
                        ) : assignment.ungradedAnswers === 0 && assignment.pendingReview === 0 ? (
                          <Link
                            to="/staff/grading"
                            search={{ assignmentId: assignment.id, submissionId: undefined }}
                            className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <EyeIcon className="h-4 w-4" />
                            View Grades
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cost Estimate Modal */}
      {selectedAssignment && (
        <CostEstimateModal
          isOpen={showCostModal}
          onClose={() => {
            setShowCostModal(false);
            setSelectedAssignment(null);
          }}
          onConfirm={handleConfirmGrading}
          assignmentId={selectedAssignment.id}
          ungradedAnswers={selectedAssignment.ungradedAnswers}
          questionTypes={['written', 'uml']}
        />
      )}
    </div>
  );
}
