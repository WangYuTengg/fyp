import type { Question } from '../../../lib/api';

type CreateAssignmentFormProps = {
  assignmentType: 'mcq' | 'written';
  setAssignmentType: (type: 'mcq' | 'written') => void;
  questions: Question[];
  selectedQuestionIds: string[];
  setSelectedQuestionIds: (ids: string[]) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
};

export function CreateAssignmentForm({
  assignmentType,
  setAssignmentType,
  questions,
  selectedQuestionIds,
  setSelectedQuestionIds,
  onSubmit,
  isSubmitting = false,
}: CreateAssignmentFormProps) {
  // Set default due date to tomorrow at 11:59 PM
  const getDefaultDueDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 0, 0);
    
    // Format as datetime-local value (YYYY-MM-DDTHH:mm)
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    const hours = String(tomorrow.getHours()).padStart(2, '0');
    const minutes = String(tomorrow.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Get minimum datetime (now)
  const getMinDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return (
    <div className="mb-6 p-4 border border-gray-200 rounded-lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            name="title"
            required
            className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            name="description"
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select
              name="type"
              required
              value={assignmentType}
              onChange={(event) => setAssignmentType(event.target.value as 'mcq' | 'written')}
              className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="mcq">MCQ</option>
              <option value="written">Written</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Due Date</label>
            <input
              type="datetime-local"
              name="dueDate"
              defaultValue={getDefaultDueDate()}
              min={getMinDateTime()}
              className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Max Attempts</label>
            <input
              type="number"
              name="maxAttempts"
              defaultValue={1}
              min={1}
              className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-medium text-gray-900">Questions (optional)</h3>
          {questions.filter((q) => q.type === assignmentType).length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              No {assignmentType.toUpperCase()} questions yet. Create some below.
            </p>
          ) : (
            <div className="mt-2 space-y-2 max-h-48 overflow-auto border border-gray-200 rounded p-3">
              {questions.filter((q) => q.type === assignmentType).map((q) => (
                <label key={q.id} className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedQuestionIds.includes(q.id)}
                    onChange={(evt) => {
                      setSelectedQuestionIds(
                        evt.target.checked
                          ? [...selectedQuestionIds, q.id]
                          : selectedQuestionIds.filter((id) => id !== q.id)
                      );
                    }}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium text-gray-900">{q.title}</span>
                    <span className="block text-xs text-gray-500">{q.points} pts</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating...' : 'Create Assignment'}
        </button>
      </form>
    </div>
  );
}
