import type { AssignmentDetails } from '../types';

type AssignmentHeaderProps = {
  assignment: AssignmentDetails;
  dueDate: Date | null;
  isPastDue: boolean;
  submitted: boolean;
  toast: string | null;
  lastSaved?: Date | null;
  isSaving?: boolean;
};

export function AssignmentHeader({
  assignment,
  dueDate,
  isPastDue,
  submitted,
  toast,
  lastSaved,
  isSaving,
}: AssignmentHeaderProps) {
  return (
    <>
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-red-600 text-white px-4 py-3 shadow-lg">
          {toast}
        </div>
      )}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
            {assignment.description && <p className="mt-2 text-gray-600">{assignment.description}</p>}
            {dueDate && <p className="mt-2 text-sm text-gray-500">Due: {dueDate.toLocaleString()}</p>}
          </div>
          {!submitted && (
            <div className="text-right">
              {isSaving ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </div>
              ) : lastSaved ? (
                <div className="text-sm text-gray-600">
                  Last saved: {lastSaved.toLocaleTimeString()}
                </div>
              ) : (
                <div className="text-sm text-yellow-600 font-medium">Not saved yet</div>
              )}
            </div>
          )}
        </div>
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
