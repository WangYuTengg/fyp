/** biome-ignore-all lint/a11y/noAutofocus: simple */
import { useMemo, useState } from 'react';
import type { Question } from '../../../lib/api';

type CreateAssignmentFormProps = {
  assignmentType: 'mcq' | 'written' | 'uml';
  setAssignmentType: (type: 'mcq' | 'written' | 'uml') => void;
  questions: Question[];
  selectedQuestionIds: string[];
  setSelectedQuestionIds: (ids: string[]) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
};

const STEP_TITLES = ['Basics', 'Settings', 'Questions', 'Review'] as const;

const getDefaultDueDate = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 0, 0);

  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  const hours = String(tomorrow.getHours()).padStart(2, '0');
  const minutes = String(tomorrow.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getMinDateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
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
  const [step, setStep] = useState(0);
  const [submitIntent, setSubmitIntent] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(getDefaultDueDate);
  const [maxAttempts, setMaxAttempts] = useState(1);

  const questionsForType = useMemo(
    () => questions.filter((q) => q.type === assignmentType),
    [assignmentType, questions]
  );

  const isLastStep = step === STEP_TITLES.length - 1;
  const canProceed = useMemo(() => {
    if (step === 0) return title.trim().length > 0;
    if (step === 1) return Number.isFinite(maxAttempts) && maxAttempts >= 1;
    return true;
  }, [maxAttempts, step, title]);

  const handleNext = () => {
    if (isLastStep || !canProceed) return;
    setSubmitIntent(false);
    setStep((current) => current + 1);
  };

  const handleBack = () => {
    if (step === 0) return;
    setSubmitIntent(false);
    setStep((current) => current - 1);
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!isLastStep) {
      e.preventDefault();
      setSubmitIntent(false);
      if (canProceed) {
        handleNext();
      }
      return;
    }
    if (!submitIntent) {
      e.preventDefault();
      return;
    }
    setSubmitIntent(false);
    onSubmit(e);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="description" value={description} />
      <input type="hidden" name="dueDate" value={dueDate} />
      <input type="hidden" name="maxAttempts" value={String(maxAttempts)} />

      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
        <span className="font-medium">Step {step + 1} of {STEP_TITLES.length}:</span> {STEP_TITLES[step]}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label htmlFor="create-assignment-title" className="block text-sm font-medium text-gray-700">Title</label>
            <input
              id="create-assignment-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input-block"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="create-assignment-description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              id="create-assignment-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="form-textarea-block"
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="create-assignment-type" className="block text-sm font-medium text-gray-700">Type</label>
            <select
              id="create-assignment-type"
              value={assignmentType}
              onChange={(event) => setAssignmentType(event.target.value as 'mcq' | 'written' | 'uml')}
              className="form-select-block"
              autoFocus
            >
              <option value="mcq">MCQ</option>
              <option value="written">Written</option>
              <option value="uml">UML</option>
            </select>
          </div>
          <div>
            <label htmlFor="create-assignment-due-date" className="block text-sm font-medium text-gray-700">Due Date</label>
            <input
              id="create-assignment-due-date"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={getMinDateTime()}
              className="form-input-block"
            />
          </div>
          <div>
            <label htmlFor="create-assignment-max-attempts" className="block text-sm font-medium text-gray-700">Max Attempts</label>
            <input
              id="create-assignment-max-attempts"
              type="number"
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Number(e.target.value) || 1)}
              min={1}
              className="form-input-block"
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-medium text-gray-900">Questions (optional)</h3>
          {questionsForType.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              No {assignmentType.toUpperCase()} questions yet. Create some below.
            </p>
          ) : (
            <div className="mt-2 space-y-2 max-h-48 overflow-auto border border-gray-200 rounded p-3">
              {questionsForType.map((q) => (
                <div key={q.id} className="flex items-start gap-3 text-sm">
                  <input
                    id={`create-assignment-question-${q.id}`}
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
                  <label htmlFor={`create-assignment-question-${q.id}`}>
                    <span className="font-medium text-gray-900">{q.title}</span>
                    <span className="block text-xs text-gray-500">{q.points} pts</span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3 rounded-md border border-gray-200 p-4 text-sm text-gray-700">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Title</p>
            <p className="font-medium text-gray-900">{title}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Type</p>
            <p className="font-medium text-gray-900">{assignmentType.toUpperCase()}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Due Date</p>
            <p className="text-gray-900">{dueDate || 'No due date set'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Max Attempts</p>
            <p className="text-gray-900">{maxAttempts}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Selected Questions</p>
            <p className="text-gray-900">{selectedQuestionIds.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Description</p>
            <p className="text-gray-900">{description.trim() || 'No description provided.'}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 0 || isSubmitting}
          className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>

        {isLastStep ? (
          <button
            type="submit"
            onClick={() => setSubmitIntent(true)}
            disabled={isSubmitting}
            className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Assignment'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
            className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        )}
      </div>
    </form>
  );
}
