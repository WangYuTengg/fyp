import { useNavigate } from '@tanstack/react-router';
import type { StudentAssignment } from '../types';
import { QUESTION_TYPE_LABELS, QUESTION_TYPE_ORDER, getQuestionTypeBadgeClasses } from '../../../lib/question-types';

type AssignmentsListProps = {
  assignments: StudentAssignment[];
};

export function AssignmentsList({ assignments }: AssignmentsListProps) {
  const navigate = useNavigate();

  const isFinalStatus = (status: StudentAssignment['submissionStatus']) =>
    status === 'submitted' || status === 'late' || status === 'grading' || status === 'graded';

  const startAssignment = (assignment: StudentAssignment) => {
    // If already submitted (or beyond), navigate to submission review instead of starting a new attempt
    if (isFinalStatus(assignment.submissionStatus) && assignment.submissionId) {
      navigate({
        to: '/student/submissions/$submissionId',
        params: { submissionId: assignment.submissionId },
      });
      return;
    }

    navigate({
      to: '/student/assignments/$assignmentId',
      params: { assignmentId: assignment.id },
    });
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-semibold mb-4">Assignments</h2>
      {assignments.length === 0 ? (
        <p className="text-gray-500">No assignments available yet.</p>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => {
            const visibleQuestionTypes = QUESTION_TYPE_ORDER.filter((type) => assignment.questionTypeCounts[type] > 0);

            return (
              <div
                key={assignment.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{assignment.title}</h3>
                      {assignment.submissionStatus === 'draft' && (
                        <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                          Draft
                        </span>
                      )}
                      {assignment.submissionStatus === 'submitted' && (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                          Submitted
                        </span>
                      )}
                      {assignment.submissionStatus === 'late' && (
                        <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded">
                          Late
                        </span>
                      )}
                      {assignment.submissionStatus === 'grading' && (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          Grading
                        </span>
                      )}
                      {assignment.submissionStatus === 'graded' && (
                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                          Graded
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mt-1">{assignment.description}</p>
                    <div className="mt-2 flex gap-4 text-sm text-gray-500">
                      {assignment.dueDate && (
                        <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                      )}
                      {assignment.maxAttempts && (
                        <span>Max Attempts: {assignment.maxAttempts}</span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        {assignment.questionCount === 0
                          ? 'No questions yet'
                          : `${assignment.questionCount} question${assignment.questionCount === 1 ? '' : 's'}`}
                      </span>
                      {visibleQuestionTypes.map((type) => (
                        <span key={type} className={getQuestionTypeBadgeClasses(type)}>
                          {assignment.questionTypeCounts[type]} {QUESTION_TYPE_LABELS[type]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => startAssignment(assignment)}
                    className="ml-4 bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
                  >
                    {isFinalStatus(assignment.submissionStatus) ? 'View' : assignment.submissionStatus === 'draft' ? 'Resume' : 'Start'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
