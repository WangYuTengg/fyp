/** biome-ignore-all lint/a11y/noAutofocus: simple */
import { useMemo, useState } from 'react';
import type { Question } from '../../../lib/api';
import { useClampedPage } from '../../../hooks/useClampedPage';
import {
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_ORDER,
  countQuestionsByType,
  formatQuestionTypeSummary,
  getQuestionTypeBadgeClasses,
  type QuestionType,
} from '../../../lib/question-types';
import { getPromptFromContent } from '../utils/question-utils';

type CreateAssignmentFormProps = {
  questions: Question[];
  selectedQuestionIds: string[];
  setSelectedQuestionIds: (ids: string[]) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isSubmitting?: boolean;
};

const STEP_TITLES = ['Basics', 'Settings', 'Questions', 'Review'] as const;
const STEP_DESCRIPTIONS = [
  'Name and describe the assignment.',
  'Schedule, attempts, and grading rules.',
  'Select and order questions.',
  'Review before publishing.',
] as const;
const QUESTION_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
const DEFAULT_TIME_LIMIT_MINUTES = 60;

function formatDateTimeInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getDefaultDueDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 0, 0);
  return formatDateTimeInputValue(tomorrow);
}

function getMinDateTime() {
  return formatDateTimeInputValue(new Date());
}

function formatDateTimeSummary(value: string) {
  if (!value.trim()) {
    return 'Not set';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function reorderItems<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }

  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

function formatQuestionCount(count: number) {
  return `${count} question${count === 1 ? '' : 's'}`;
}

function getVisibleQuestionTypes(questions: Question[]) {
  const counts = countQuestionsByType(questions);
  return QUESTION_TYPE_ORDER.filter((type) => counts[type] > 0);
}

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
  const [enableOpenDate, setEnableOpenDate] = useState(false);
  const [openDate, setOpenDate] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [hasTimeLimit, setHasTimeLimit] = useState(false);
  const [timeLimit, setTimeLimit] = useState(DEFAULT_TIME_LIMIT_MINUTES);
  const [mcqPenaltyPerWrongSelection, setMcqPenaltyPerWrongSelection] = useState(1);
  const [monitorFocus, setMonitorFocus] = useState(false);
  const [hasMaxTabSwitches, setHasMaxTabSwitches] = useState(false);
  const [maxTabSwitches, setMaxTabSwitches] = useState(5);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [latePenaltyType, setLatePenaltyType] = useState<'none' | 'fixed' | 'per_day' | 'per_hour'>('none');
  const [latePenaltyValue, setLatePenaltyValue] = useState(10);
  const [latePenaltyCap, setLatePenaltyCap] = useState(50);
  const [enableLatePenaltyCap, setEnableLatePenaltyCap] = useState(false);
  const [attemptScoringMethod, setAttemptScoringMethod] = useState<'latest' | 'highest'>('latest');
  const [questionSearch, setQuestionSearch] = useState('');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [questionPageSize, setQuestionPageSize] = useState<number>(20);
  const [typeFilters, setTypeFilters] = useState<QuestionType[]>([]);

  const availableQuestions = useMemo(
    () => [...questions].sort((a, b) => a.title.localeCompare(b.title)),
    [questions]
  );

  const questionsById = useMemo(
    () => new Map(availableQuestions.map((question) => [question.id, question])),
    [availableQuestions]
  );

  const selectedQuestionSet = useMemo(() => new Set(selectedQuestionIds), [selectedQuestionIds]);

  const selectedQuestions = useMemo(
    () =>
      selectedQuestionIds
        .map((questionId) => questionsById.get(questionId))
        .filter((question): question is Question => Boolean(question)),
    [questionsById, selectedQuestionIds]
  );

  const availableTypeCounts = useMemo(() => countQuestionsByType(availableQuestions), [availableQuestions]);
  const selectedTypeCounts = useMemo(() => countQuestionsByType(selectedQuestions), [selectedQuestions]);
  const totalSelectedPoints = useMemo(
    () => selectedQuestions.reduce((sum, question) => sum + question.points, 0),
    [selectedQuestions]
  );

  const visibleQuestionTypes = useMemo(() => getVisibleQuestionTypes(availableQuestions), [availableQuestions]);

  const filteredQuestions = useMemo(() => {
    const search = questionSearch.trim().toLowerCase();

    return availableQuestions.filter((question) => {
      if (showSelectedOnly && !selectedQuestionSet.has(question.id)) {
        return false;
      }

      if (typeFilters.length > 0 && !typeFilters.includes(question.type)) {
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
  }, [availableQuestions, questionSearch, selectedQuestionSet, showSelectedOnly, typeFilters]);

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

  const settingsValidationMessage = useMemo(() => {
    if (!dueDate.trim()) {
      return 'Choose a due date.';
    }

    const dueDateValue = new Date(dueDate);
    if (Number.isNaN(dueDateValue.getTime())) {
      return 'Choose a valid due date.';
    }

    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
      return 'Max attempts must be at least 1.';
    }

    if (!Number.isInteger(mcqPenaltyPerWrongSelection) || mcqPenaltyPerWrongSelection < 0) {
      return 'Penalty must be 0 or higher.';
    }

    if (hasTimeLimit && (!Number.isInteger(timeLimit) || timeLimit < 1)) {
      return 'Time limit must be at least 1 minute.';
    }

    if (!enableOpenDate) {
      return null;
    }

    if (!openDate.trim()) {
      return 'Choose an open date or turn off the open date option.';
    }

    const openDateValue = new Date(openDate);
    if (Number.isNaN(openDateValue.getTime())) {
      return 'Choose a valid open date.';
    }

    if (openDateValue >= dueDateValue) {
      return 'Open date must be earlier than the due date.';
    }

    return null;
  }, [dueDate, enableOpenDate, hasTimeLimit, maxAttempts, mcqPenaltyPerWrongSelection, openDate, timeLimit]);

  const isLastStep = step === STEP_TITLES.length - 1;
  const canProceed = useMemo(() => {
    if (step === 0) {
      return title.trim().length > 0;
    }

    if (step === 1) {
      return settingsValidationMessage === null;
    }

    return true;
  }, [settingsValidationMessage, step, title]);

  const pageStart = filteredQuestions.length === 0 ? 0 : (questionPage - 1) * questionPageSize + 1;
  const pageEnd = Math.min(questionPage * questionPageSize, filteredQuestions.length);
  const pageRangeLabel = filteredQuestions.length === 0 ? '0' : `${pageStart}-${pageEnd}`;

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

  const moveSelectedQuestion = (questionId: string, direction: 'up' | 'down') => {
    const currentIndex = selectedQuestionIds.indexOf(questionId);
    if (currentIndex === -1) {
      return;
    }

    const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    updateSelectedQuestionIds(reorderItems(selectedQuestionIds, currentIndex, nextIndex));
  };

  const removeSelectedQuestion = (questionId: string) => {
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

  const clearAllSelected = () => {
    setSelectedQuestionIds([]);
  };

  const toggleTypeFilter = (type: QuestionType) => {
    setTypeFilters((currentFilters) =>
      currentFilters.includes(type)
        ? currentFilters.filter((currentType) => currentType !== type)
        : [...currentFilters, type]
    );
    resetQuestionPage();
  };

  const handleNext = () => {
    if (isLastStep || !canProceed) {
      return;
    }

    setSubmitIntent(false);
    setStep((currentStep) => currentStep + 1);
  };

  const handleBack = () => {
    if (step === 0) {
      return;
    }

    setSubmitIntent(false);
    setStep((currentStep) => currentStep - 1);
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
    <form onSubmit={handleFormSubmit} className="space-y-6">
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="description" value={description} />
      <input type="hidden" name="dueDate" value={dueDate} />
      <input type="hidden" name="openDate" value={enableOpenDate ? openDate : ''} />
      <input type="hidden" name="maxAttempts" value={String(maxAttempts)} />
      <input type="hidden" name="mcqPenaltyPerWrongSelection" value={String(mcqPenaltyPerWrongSelection)} />
      <input type="hidden" name="timeLimit" value={hasTimeLimit ? String(timeLimit) : ''} />
      <input type="hidden" name="monitorFocus" value={monitorFocus ? 'true' : 'false'} />
      <input type="hidden" name="maxTabSwitches" value={monitorFocus && hasMaxTabSwitches ? String(maxTabSwitches) : ''} />
      <input type="hidden" name="shuffleQuestions" value={shuffleQuestions ? '1' : '0'} />
      <input type="hidden" name="latePenaltyType" value={latePenaltyType} />
      <input type="hidden" name="latePenaltyValue" value={latePenaltyType !== 'none' ? String(latePenaltyValue) : ''} />
      <input type="hidden" name="latePenaltyCap" value={latePenaltyType !== 'none' && enableLatePenaltyCap ? String(latePenaltyCap) : ''} />
      <input type="hidden" name="attemptScoringMethod" value={attemptScoringMethod} />

      <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-slate-50 to-blue-50 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900">Create Assignment</h3>
            <p className="mt-1 text-sm text-gray-600">
              Pick questions from your pool and configure how students will see them.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-white bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Selected</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{formatQuestionCount(selectedQuestions.length)}</p>
            </div>
            <div className="rounded-lg border border-white bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total points</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">{totalSelectedPoints}</p>
            </div>
            <div className="rounded-lg border border-white bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Question mix</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{formatQuestionTypeSummary(selectedTypeCounts)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STEP_TITLES.map((stepTitle, index) => {
          const isCurrentStep = index === step;
          const isComplete = index < step;

          return (
            <div
              key={stepTitle}
              className={`rounded-xl border px-4 py-3 transition-colors ${
                isCurrentStep
                  ? 'border-blue-300 bg-blue-50'
                  : isComplete
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    isCurrentStep
                      ? 'bg-blue-600 text-white'
                      : isComplete
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{stepTitle}</p>
                  <p className="text-xs text-gray-500">{STEP_DESCRIPTIONS[index]}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {step === 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)]">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-base font-semibold text-gray-900">Assignment details</h3>
            <p className="mt-1 text-sm text-gray-600">
              Use a clear title and short description so students understand what the assignment is asking for.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="create-assignment-title" className="block text-sm font-medium text-gray-700">
                  Title
                </label>
                <input
                  id="create-assignment-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Example: UML modeling and short-answer review"
                  className="form-input-block"
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="create-assignment-description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="create-assignment-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="Add instructions, scope, or notes for students."
                  className="form-textarea-block"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
            <h3 className="text-base font-semibold text-gray-900">Tips</h3>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <p>Keep the title short and scannable.</p>
              <p>Use the description for instructions or submission guidance.</p>
              <p>Question-specific details belong in each question, not here.</p>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-base font-semibold text-gray-900">Availability</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="create-assignment-due-date" className="block text-sm font-medium text-gray-700">
                    Due date
                  </label>
                  <input
                    id="create-assignment-due-date"
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={getMinDateTime()}
                    className="form-input-block"
                  />
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={enableOpenDate}
                      onChange={(e) => {
                        setEnableOpenDate(e.target.checked);
                        if (!e.target.checked) {
                          setOpenDate('');
                        }
                      }}
                    />
                    Set a separate open date
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    Leave this off to make the assignment available immediately after creation and publishing.
                  </p>
                  {enableOpenDate && (
                    <div className="mt-3">
                      <label htmlFor="create-assignment-open-date" className="block text-sm font-medium text-gray-700">
                        Open date
                      </label>
                      <input
                        id="create-assignment-open-date"
                        type="datetime-local"
                        value={openDate}
                        onChange={(e) => setOpenDate(e.target.value)}
                        min={getMinDateTime()}
                        className="form-input-block"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-base font-semibold text-gray-900">Attempts and grading rules</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="create-assignment-max-attempts" className="block text-sm font-medium text-gray-700">
                    Max attempts
                  </label>
                  <input
                    id="create-assignment-max-attempts"
                    type="number"
                    value={maxAttempts}
                    onChange={(e) => {
                      const nextValue = Number(e.target.value);
                      setMaxAttempts(Number.isFinite(nextValue) ? Math.max(1, Math.floor(nextValue)) : 1);
                    }}
                    min={1}
                    step={1}
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
                      setMcqPenaltyPerWrongSelection(Number.isFinite(nextValue) ? Math.max(0, Math.floor(nextValue)) : 0);
                    }}
                    min={0}
                    step={1}
                    className="form-input-block"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Applied when students choose incorrect options in multi-answer MCQs.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={hasTimeLimit}
                    onChange={(e) => {
                      setHasTimeLimit(e.target.checked);
                      if (!e.target.checked) {
                        setTimeLimit(DEFAULT_TIME_LIMIT_MINUTES);
                      }
                    }}
                  />
                  Add a time limit
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  Use this when the assignment should stay timed once a student starts.
                </p>
                {hasTimeLimit && (
                  <div className="mt-3 max-w-xs">
                    <label htmlFor="create-assignment-time-limit" className="block text-sm font-medium text-gray-700">
                      Time limit (minutes)
                    </label>
                    <input
                      id="create-assignment-time-limit"
                      type="number"
                      value={timeLimit}
                      onChange={(e) => {
                        const nextValue = Number(e.target.value);
                        setTimeLimit(Number.isFinite(nextValue) ? Math.max(1, Math.floor(nextValue)) : 1);
                      }}
                      min={1}
                      step={1}
                      className="form-input-block"
                    />
                  </div>
                )}
              </div>

              {/* Focus Monitoring */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={monitorFocus}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    onChange={(e) => {
                      setMonitorFocus(e.target.checked);
                      if (!e.target.checked) {
                        setHasMaxTabSwitches(false);
                        setMaxTabSwitches(5);
                      }
                    }}
                  />
                  Monitor tab switches
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  Track when students leave the exam tab. Tab switches are logged and visible during grading.
                </p>
                {monitorFocus && (
                  <div className="mt-3 space-y-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasMaxTabSwitches}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        onChange={(e) => {
                          setHasMaxTabSwitches(e.target.checked);
                          if (!e.target.checked) {
                            setMaxTabSwitches(5);
                          }
                        }}
                      />
                      Auto-submit after threshold
                    </label>
                    {hasMaxTabSwitches && (
                      <div className="max-w-xs">
                        <label htmlFor="create-assignment-max-tab-switches" className="block text-sm font-medium text-gray-700">
                          Max tab switches before auto-submit
                        </label>
                        <input
                          id="create-assignment-max-tab-switches"
                          type="number"
                          value={maxTabSwitches}
                          onChange={(e) => {
                            const nextValue = Number(e.target.value);
                            setMaxTabSwitches(Number.isFinite(nextValue) ? Math.max(1, Math.floor(nextValue)) : 1);
                          }}
                          min={1}
                          step={1}
                          className="form-input-block"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                  />
                  Randomize question order
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  Each student sees questions in a unique random order, reducing the chance of copying in a lab setting.
                </p>
              </div>

              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                <div>
                  <label htmlFor="create-assignment-penalty-type" className="block text-sm font-medium text-gray-700">
                    Late submission penalty
                  </label>
                  <select
                    id="create-assignment-penalty-type"
                    value={latePenaltyType}
                    onChange={(e) => setLatePenaltyType(e.target.value as typeof latePenaltyType)}
                    className="form-input-block mt-1"
                  >
                    <option value="none">No penalty</option>
                    <option value="fixed">Fixed deduction</option>
                    <option value="per_hour">Per hour late</option>
                    <option value="per_day">Per day late</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Automatically deduct marks when students submit after the due date or timer expiry.
                  </p>
                </div>

                {latePenaltyType !== 'none' && (
                  <div className="space-y-3 border-t border-gray-200 pt-3">
                    <div className="max-w-xs">
                      <label htmlFor="create-assignment-penalty-value" className="block text-sm font-medium text-gray-700">
                        Penalty (%)
                      </label>
                      <input
                        id="create-assignment-penalty-value"
                        type="number"
                        value={latePenaltyValue}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setLatePenaltyValue(Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0);
                        }}
                        min={0}
                        max={100}
                        step={1}
                        className="form-input-block"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        {latePenaltyType === 'fixed'
                          ? 'Flat percentage deducted from the total score.'
                          : latePenaltyType === 'per_hour'
                            ? 'Percentage deducted for each hour past the deadline.'
                            : 'Percentage deducted for each calendar day past the deadline.'}
                      </p>
                    </div>

                    <div>
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                          type="checkbox"
                          checked={enableLatePenaltyCap}
                          onChange={(e) => setEnableLatePenaltyCap(e.target.checked)}
                        />
                        Cap maximum penalty
                      </label>
                      {enableLatePenaltyCap && (
                        <div className="mt-2 max-w-xs">
                          <input
                            id="create-assignment-penalty-cap"
                            type="number"
                            value={latePenaltyCap}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setLatePenaltyCap(Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0);
                            }}
                            min={0}
                            max={100}
                            step={1}
                            className="form-input-block"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Maximum penalty percentage. Prevents excessive deductions for very late submissions.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {maxAttempts > 1 && (
                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <label htmlFor="create-assignment-scoring-method" className="block text-sm font-medium text-gray-700">
                    Attempt scoring method
                  </label>
                  <select
                    id="create-assignment-scoring-method"
                    value={attemptScoringMethod}
                    onChange={(e) => setAttemptScoringMethod(e.target.value as typeof attemptScoringMethod)}
                    className="form-input-block mt-1"
                  >
                    <option value="latest">Use latest attempt</option>
                    <option value="highest">Use highest score</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Determines which attempt counts towards the student&apos;s final grade when multiple attempts are allowed.
                  </p>
                </div>
              )}
            </div>
          </div>

          {settingsValidationMessage && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {settingsValidationMessage}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Select questions</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    Search the pool, filter by type, then build the exact mixed sequence you want students to answer.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Pool size</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900">{availableQuestions.length}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Selected mix</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{formatQuestionTypeSummary(selectedTypeCounts)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_160px]">
                <div>
                  <label htmlFor="assignment-question-search" className="block text-sm font-medium text-gray-700">
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
                    placeholder="Search by title, prompt, or tag"
                    className="form-input-block"
                  />
                </div>

                <div>
                  <label htmlFor="assignment-question-page-size" className="block text-sm font-medium text-gray-700">
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

              {visibleQuestionTypes.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Filter by type</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {visibleQuestionTypes.map((type) => {
                      const isActive = typeFilters.includes(type);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => toggleTypeFilter(type)}
                          aria-pressed={isActive}
                          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                            isActive
                              ? 'border-blue-300 bg-blue-50 text-blue-700'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {QUESTION_TYPE_LABELS[type]} ({availableTypeCounts[type]})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
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
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-white"
                >
                  Select page
                </button>
                <button
                  type="button"
                  onClick={clearVisible}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-white"
                >
                  Clear page
                </button>
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-white"
                >
                  Select filtered
                </button>
                <button
                  type="button"
                  onClick={clearFiltered}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-white"
                >
                  Clear filtered
                </button>
                {selectedQuestionIds.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllSelected}
                    className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                  >
                    Clear all selected
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
                <p>
                  Showing <span className="font-medium text-gray-900">{pageRangeLabel}</span> of{' '}
                  <span className="font-medium text-gray-900">{filteredQuestions.length}</span> matching questions
                </p>
                <p>
                  Selected <span className="font-medium text-gray-900">{selectedQuestionIds.length}</span> total
                </p>
              </div>

              {filteredQuestions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                  <p className="font-medium text-gray-900">No questions match the current filters.</p>
                  <p className="mt-1 text-sm text-gray-500">Try changing the search, clearing type filters, or showing all questions again.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pagedQuestions.map((question) => {
                    const isSelected = selectedQuestionSet.has(question.id);

                    return (
                      <div
                        key={question.id}
                        className={`rounded-xl border p-4 transition-colors ${
                          isSelected ? 'border-blue-300 bg-blue-50/60' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            id={`create-assignment-question-${question.id}`}
                            type="checkbox"
                            checked={isSelected}
                            onChange={(event) => toggleQuestionSelection(question.id, event.target.checked)}
                            className="mt-1"
                          />
                          <label htmlFor={`create-assignment-question-${question.id}`} className="min-w-0 flex-1 cursor-pointer">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-gray-900">{question.title}</span>
                              <span className={getQuestionTypeBadgeClasses(question.type)}>
                                {QUESTION_TYPE_LABELS[question.type]}
                              </span>
                              <span className="text-xs font-medium text-gray-500">{question.points} pts</span>
                            </div>
                            <p className="mt-2 text-sm text-gray-600">{getPromptFromContent(question.content)}</p>
                            {question.tags && question.tags.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {question.tags.slice(0, 4).map((tag) => (
                                  <span
                                    key={tag}
                                    className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600"
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {question.tags.length > 4 && (
                                  <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                                    +{question.tags.length - 4} more
                                  </span>
                                )}
                              </div>
                            )}
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {totalQuestionPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Page {questionPage} of {totalQuestionPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setQuestionPage((currentPage) => Math.max(1, currentPage - 1))}
                      disabled={questionPage === 1}
                      className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionPage((currentPage) => Math.min(totalQuestionPages, currentPage + 1))}
                      disabled={questionPage === totalQuestionPages}
                      className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Selected order</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Reorder questions here. Students will see them in this sequence.
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total points</p>
                <p className="text-sm font-semibold text-gray-900">{totalSelectedPoints}</p>
              </div>
            </div>

            {selectedQuestions.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-6 text-center">
                <p className="font-medium text-gray-900">No questions selected yet.</p>
                <p className="mt-1 text-sm text-gray-500">Pick any mix of question types from the list on the left.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {selectedQuestions.map((question, index) => (
                  <div key={question.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-gray-900 px-2 text-xs font-semibold text-white">
                            {index + 1}
                          </span>
                          <span className="font-medium text-gray-900">{question.title}</span>
                          <span className={getQuestionTypeBadgeClasses(question.type)}>
                            {QUESTION_TYPE_LABELS[question.type]}
                          </span>
                          <span className="text-xs font-medium text-gray-500">{question.points} pts</span>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">{getPromptFromContent(question.content)}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => moveSelectedQuestion(question.id, 'up')}
                          disabled={index === 0}
                          className="rounded border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSelectedQuestion(question.id, 'down')}
                          disabled={index === selectedQuestions.length - 1}
                          className="rounded border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSelectedQuestion(question.id)}
                          className="rounded border border-red-200 px-2.5 py-1.5 text-sm text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="text-base font-semibold text-gray-900">Assignment summary</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Title</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{title}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Due date</p>
                  <p className="mt-1 text-sm text-gray-900">{formatDateTimeSummary(dueDate)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Open date</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {enableOpenDate ? formatDateTimeSummary(openDate) : 'Open immediately'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Time limit</p>
                  <p className="mt-1 text-sm text-gray-900">{hasTimeLimit ? `${timeLimit} minutes` : 'No time limit'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Max attempts</p>
                  <p className="mt-1 text-sm text-gray-900">{maxAttempts}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Multi-answer penalty</p>
                  <p className="mt-1 text-sm text-gray-900">{mcqPenaltyPerWrongSelection} per wrong option</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Focus monitoring</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {monitorFocus
                      ? hasMaxTabSwitches
                        ? `Enabled (auto-submit after ${maxTabSwitches} tab switches)`
                        : 'Enabled (tracking only)'
                      : 'Disabled'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Question order</p>
                  <p className="mt-1 text-sm text-gray-900">{shuffleQuestions ? 'Randomized per student' : 'Fixed order'}</p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Description</p>
                <p className="mt-1 text-sm text-gray-900">{description.trim() || 'No description provided.'}</p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <h3 className="text-base font-semibold text-gray-900">Question composition</h3>
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Questions</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{formatQuestionCount(selectedQuestions.length)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total points</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">{totalSelectedPoints}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Type mix</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{formatQuestionTypeSummary(selectedTypeCounts)}</p>
                </div>
              </div>
            </div>
          </div>

          {selectedQuestions.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              This assignment will be created without questions. You can still use it as a shell and add questions later.
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-gray-900">Question order preview</h3>
                <p className="text-sm text-gray-500">{formatQuestionCount(selectedQuestions.length)}</p>
              </div>
              <div className="mt-4 space-y-3">
                {selectedQuestions.map((question, index) => (
                  <div key={question.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-gray-900 px-2 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <span className="font-medium text-gray-900">{question.title}</span>
                      <span className={getQuestionTypeBadgeClasses(question.type)}>
                        {QUESTION_TYPE_LABELS[question.type]}
                      </span>
                      <span className="text-xs font-medium text-gray-500">{question.points} pts</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{getPromptFromContent(question.content)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 0 || isSubmitting}
          className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Back
        </button>

        {isLastStep ? (
          <button
            type="submit"
            onClick={() => setSubmitIntent(true)}
            disabled={isSubmitting}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create assignment'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed || isSubmitting}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        )}
      </div>
    </form>
  );
}
