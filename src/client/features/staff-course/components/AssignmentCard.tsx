import type { StaffAssignment } from '../types';

type AssignmentCardProps = {
  assignment: StaffAssignment;
  onTogglePublish: (assignmentId: string, isPublished: boolean) => void;
};

export function AssignmentCard({ assignment, onTogglePublish }: AssignmentCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">{assignment.title}</h3>
            {assignment.isPublished ? (
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                Published
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                Draft
              </span>
            )}
          </div>
          <p className="text-gray-600 mt-1">{assignment.description}</p>
          <div className="mt-2 flex gap-4 text-sm text-gray-500">
            <span>Type: {assignment.type.toUpperCase()}</span>
            {assignment.dueDate && (
              <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => onTogglePublish(assignment.id, assignment.isPublished)}
          className={`ml-4 font-medium py-2 px-4 rounded ${
            assignment.isPublished
              ? 'bg-gray-200 hover:bg-gray-300 text-gray-800'
              : 'bg-green-500 hover:bg-green-700 text-white'
          }`}
        >
          {assignment.isPublished ? 'Unpublish' : 'Publish'}
        </button>
      </div>
    </div>
  );
}
