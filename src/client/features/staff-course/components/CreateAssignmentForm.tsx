/** biome-ignore-all lint/a11y/noAutofocus: simple */
import { useMemo, useState } from 'react';
import type { Question } from '../../../lib/api';
import { useClampedPage } from '../../../hooks/useClampedPage';
import { getPromptFromContent } from '../utils/question-utils';

type CreateAssignmentFormProps = {
  questions: Question[];
  selectedQuestionIds: string[];
  setSelectedQuestionIds: (ids: string[]) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
};

const STEP_TITLES = ['Basics', 'Settings', 'Questions', 'Review'] as const;
const QUESTION_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

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
  const [mcqPenaltyPerWrongSelection, setMcqPenaltyPerWrongSelection] = useState(1);
  const [questionSearch, setQuestionSearch] = useState('');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [questionPageSize, setQuestionPageSize] = useState<number>(20);

  const availableQuestions = useMemo(
    () => [...questions].sort((a, b) => a.title.localeCompare(b.title)),
    [questions]
  );

  const filteredQuestions = useMemo(() => {
    const search = questionSearch.trim().toLowerCase();

    return availableQuestions
      .filter((question) => {
        if (showSelectedOnly && !selectedQuestionIds.includes(question.id)) {
          return false;
        }

        if (!search) {
          return true;
        }

        const titleMatch = question.title.toLowerCase().includes(search);
        const promptMatch = getPromptFromContent(question.content).toLowerCase().includes(search);
        const tagMatch = (question.tags || []).some((tag) => tag.toLowerCase().includes(search));
        return titleMatch || promptMatch || tagMatch;
      });
  }, [availableQuestions, questionSearch, selectedQuestionIds, showSelectedOnly]);

  const filteredQuestionIds = useMemo(
    () => filteredQuestions.map((question) => question.id),
    [filteredQuestions]
  );

  const totalQuestionPages = Math.max(1, Math.ceil(filteredQuestions.length / questionPageSize));
  const { page: questionPage, setPage: setQuestionPage, resetPage: resetQuestionPage } =
    useClampedPage(totalQuestionPages);

  const pagedQuestions = useMemo(() => {
    const start = (questionPage - 1) * questionPageSize;
    return filteredQuestions.slice(start, start + questionPageSize);
  }, [filteredQuestions, questionPage, questionPageSize]);

  const visibleQuestionIds = useMemo(
    () => pagedQuestions.map((question) => question.id),
    [pagedQuestions]
  );

  const isLastStep = step === STEP_TITLES.length - 1;
  const canProceed = useMemo(() => {
    if (step === 0) return title.trim().length > 0;
    if (step === 1) {
      const hasValidMaxAttempts = Number.isFinite(maxAttempts) && maxAttempts >= 1;
      const hasValidPenalty = Number.isFinite(mcqPenaltyPerWrongSelection) && mcqPenaltyPerWrongSelection >= 0;
      return hasValidMaxAttempts && hasValidPenalty;
    }
    return true;
  }, [maxAttempts, mcqPenaltyPerWrongSelection, step, title]);

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

  const updateSelectedQuestionIds = (ids: string[]) => {
    setSelectedQuestionIds(Array.from(new Set(ids)));
  };

  const toggleQuestionSelection = (questionId: string, checked: boolean) => {
    if (checked) {
      updateSelectedQuestionIds([...selectedQuestionIds, questionId]);
      return;
    }
    updateSelectedQuestionIds(selectedQuestionIds.filter((id) => id !== questionId));
  };

  const selectAllFiltered = () => {
    updateSelectedQuestionIds([...selectedQuestionIds, ...filteredQuestionIds]);
  };

  const clearFiltered = () => {
    const filteredSet = new Set(filteredQuestionIds);
    updateSelectedQuestionIds(selectedQuestionIds.filter((id) => !filteredSet.has(id)));
  };

  const selectVisible = () => {
    updateSelectedQuestionIds([...selectedQuestionIds, ...visibleQuestionIds]);
  };

  const clearVisible = () => {
    const visibleSet = new Set(visibleQuestionIds);
    updateSelectedQuestionIds(selectedQuestionIds.filter((id) => !visibleSet.has(id)));
  };

  const pageStart = filteredQuestions.length === 0 ? 0 : (questionPage - 1) * questionPageSize + 1;
  const pageEnd = Math.min(questionPage * questionPageSize, filteredQuestions.length);
  const pageRangeLabel = filteredQuestions.length === 0 ? '0' : `${pageStart}-${pageEnd}`;

  return (
    <form onSubmit={handleFormSubmit} className="space-y-4">
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="description" value={description} />
      <input type="hidden" name="dueDate" value={dueDate} />
      <input type="hidden" name="maxAttempts" value={String(maxAttempts)} />
      <input
        type="hidden"
        name="mcqPenaltyPerWrongSelection"
        value={String(mcqPenaltyPerWrongSelection)}
      />

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <div>
            <label htmlFor="create-assignment-mcq-penalty" className="block text-sm font-medium text-gray-700">
              Multi-answer penalty
            </label>
            <input
              id="create-assignment-mcq-penalty"
              type="number"
              value={mcqPenaltyPerWrongSelection}
              onChange={(e) => {
                const nextValue = Number(e.target.value);
                setMcqPenaltyPerWrongSelection(Number.isFinite(nextValue) ? nextValue : 0);
              }}
              min={0}
              step={1}
              className="form-input-block"
            />
            <p className="mt-1 text-xs text-gray-500">
              Points deducted per wrong selected option (multi-answer MCQ only).
            </p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="border-t border-gray-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-gray-900">Questions (optional)</h3>
            <p className="text-xs text-gray-500">
              Selected {selectedQuestionIds.length} of {availableQuestions.length} questions
            </p>
          </div>
          {availableQuestions.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">
              No questions yet. Create some below.
            </p>
          ) : (
            <div className="mt-2 space-y-3 rounded border border-gray-200 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label htmlFor="assignment-question-search" className="block text-xs font-medium text-gray-600">
                    Search questions
                  </label>
                  <input
                    id="assignment-question-search"
                    type="text"
                    value={questionSearch}
                    onChange={(event) => {
                      setQuestionSearch(event.target.value);
                      resetQuestionPage();
                    }}
                    placeholder="Title, prompt, or tag"
                    className="form-input-block"
                  />
                </div>
                <div>
                  <label htmlFor="assignment-question-page-size" className="block text-xs font-medium text-gray-600">
                    Per page
                  </label>
                  <select
                    id="assignment-question-page-size"
                    value={String(questionPageSize)}
                    onChange={(event) => {
                      setQuestionPageSize(Number(event.target.value));
                      resetQuestionPage();
                    }}
                    className="form-select-block"
                  >
                    {QUESTION_PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={showSelectedOnly}
                    onChange={(event) => {
                      setShowSelectedOnly(event.target.checked);
                      resetQuestionPage();
                    }}
                  />
                  Show selected only
                </label>
                <button
                  type="button"
                  onClick={selectVisible}
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Select page
                </button>
                <button
                  type="button"
                  onClick={clearVisible}
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Clear page
                </button>
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Select all filtered
                </button>
                <button
                  type="button"
                  onClick={clearFiltered}
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Clear filtered
                </button>
              </div>

              <p className="text-xs text-gray-500">
                Showing {pageRangeLabel} of {filteredQuestions.length} filtered questions
              </p>

              {filteredQuestions.length === 0 ? (
                <p className="text-sm text-gray-500">No questions match your current filters.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-auto">
                  {pagedQuestions.map((q) => (
                    <div key={q.id} className="flex items-start gap-3 rounded border border-gray-100 px-2 py-2 text-sm hover:bg-gray-50">
                      <input
                        id={`create-assignment-question-${q.id}`}
                        type="checkbox"
                        checked={selectedQuestionIds.includes(q.id)}
                        onChange={(evt) => toggleQuestionSelection(q.id, evt.target.checked)}
                        className="mt-1"
                      />
                      <label htmlFor={`create-assignment-question-${q.id}`} className="min-w-0">
                        <span className="font-medium text-gray-900">{q.title}</span>
                        <span className="block text-xs text-gray-500 mt-1">{q.points} pts</span>
                        <span className="block text-xs text-gray-500 truncate">{getPromptFromContent(q.content)}</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {totalQuestionPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Page {questionPage} of {totalQuestionPages}
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setQuestionPage((currentPage) => Math.max(1, currentPage - 1))}
                      disabled={questionPage === 1}
                      className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionPage((currentPage) => Math.min(totalQuestionPages, currentPage + 1))}
                      disabled={questionPage === totalQuestionPages}
                      className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
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
            <p className="text-xs uppercase tracking-wide text-gray-500">Due Date</p>
            <p className="text-gray-900">{dueDate || 'No due date set'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Max Attempts</p>
            <p className="text-gray-900">{maxAttempts}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Multi-answer Penalty</p>
            <p className="text-gray-900">{mcqPenaltyPerWrongSelection} per wrong selection</p>
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
