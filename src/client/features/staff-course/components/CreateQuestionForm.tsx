import type { McqOption } from '../../../lib/api';
import type { StaffAssignment } from '../types';

type CreateQuestionFormProps = {
  questionType: 'mcq' | 'written';
  setQuestionType: (type: 'mcq' | 'written') => void;
  mcqOptions: McqOption[];
  setMcqOptions: (options: McqOption[]) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
  assignments: StaffAssignment[];
  selectedAssignmentId: string;
  setSelectedAssignmentId: (id: string) => void;
};

export function CreateQuestionForm({
  questionType,
  setQuestionType,
  mcqOptions,
  setMcqOptions,
  onSubmit,
  isSubmitting = false,
  assignments,
  selectedAssignmentId,
  setSelectedAssignmentId,
}: CreateQuestionFormProps) {
  return (
    <div className="mb-6 p-4 border border-gray-200 rounded-lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            name="qTitle"
            required
            className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Prompt (optional)</label>
          <textarea
            name="qPrompt"
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Points</label>
          <input
            type="number"
            name="qPoints"
            defaultValue={10}
            min={1}
            className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Question Type</label>
          <select
            value={questionType}
            onChange={(event) => setQuestionType(event.target.value as 'mcq' | 'written')}
            className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="written">Written</option>
            <option value="mcq">MCQ</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Add to Assignment (optional)
          </label>
          <select
            value={selectedAssignmentId}
            onChange={(event) => setSelectedAssignmentId(event.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">-- None (add to question pool only) --</option>
            {assignments
              .filter((a) => a.type === questionType)
              .map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.title}
                </option>
              ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Only {questionType.toUpperCase()} assignments are shown
          </p>
        </div>

        {questionType === 'mcq' && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Options</label>
            {mcqOptions.map((option, index) => (
              <input
                key={option.id}
                type="text"
                value={option.text}
                onChange={(event) => {
                  const value = event.target.value;
                  setMcqOptions(
                    mcqOptions.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, text: value } : item
                    )
                  );
                }}
                className="mt-1 block w-full rounded-md border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder={`Option ${index + 1}`}
              />
            ))}
            <button
              type="button"
              onClick={() =>
                setMcqOptions([...mcqOptions, { id: crypto.randomUUID(), text: '' }])
              }
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              + Add option
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating...' : 'Create Question'}
        </button>
      </form>
    </div>
  );
}
