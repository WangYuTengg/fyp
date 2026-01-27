import { useNavigate } from '@tanstack/react-router';
import type { StudentAssignment } from '../types';

type AssignmentsListProps = {
  assignments: StudentAssignment[];
};

export function AssignmentsList({ assignments }: AssignmentsListProps) {
  const navigate = useNavigate();

  const startAssignment = (assignmentId: string) => {
    navigate({
      to: '/student/assignments/$assignmentId',
      params: { assignmentId },
    });
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-semibold mb-4">Assignments</h2>
      {assignments.length === 0 ? (
        <p className="text-gray-500">No assignments available yet.</p>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => (
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
                  </div>
                  <p className="text-gray-600 mt-1">{assignment.description}</p>
                  <div className="mt-2 flex gap-4 text-sm text-gray-500">
                    <span>Type: {assignment.type.toUpperCase()}</span>
                    {assignment.dueDate && (
                      <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                    )}
                    {assignment.maxAttempts && (
                      <span>Max Attempts: {assignment.maxAttempts}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => startAssignment(assignment.id)}
                  className="ml-4 bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
                >
                  {assignment.submissionStatus === 'submitted' || assignment.submissionStatus === 'late' ? 'View' : assignment.submissionStatus === 'draft' ? 'Resume' : 'Start'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
