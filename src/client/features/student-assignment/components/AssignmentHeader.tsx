import type { AssignmentDetails } from '../types';

type AssignmentHeaderProps = {
  assignment: AssignmentDetails;
  dueDate: Date | null;
  isPastDue: boolean;
  submitted: boolean;
  toast: string | null;
};

export function AssignmentHeader({
  assignment,
  dueDate,
  isPastDue,
  submitted,
  toast,
}: AssignmentHeaderProps) {
  return (
    <>
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-red-600 text-white px-4 py-3 shadow-lg">
          {toast}
        </div>
      )}
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
        {assignment.description && <p className="mt-2 text-gray-600">{assignment.description}</p>}
        {dueDate && <p className="mt-2 text-sm text-gray-500">Due: {dueDate.toLocaleString()}</p>}
        {isPastDue && (
          <div className="mt-4 rounded-md bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">
              Past due. Saving is disabled, but you can still submit your last saved answers.
            </p>
          </div>
        )}
        {submitted && (
          <div className="mt-4 rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-800">Submitted successfully.</p>
          </div>
        )}
      </div>
    </>
  );
}
