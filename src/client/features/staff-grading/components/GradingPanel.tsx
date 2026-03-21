import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GradingAnswer, GradingAssignment, GradingSubmission, QuestionGrade, TabSwitchEvent } from '../types';
import { QuestionGradeCard } from './QuestionGradeCard';
import { TabSwitchLog } from './TabSwitchLog';
import { rubricsApi } from '../../../lib/api';

type GradingPanelProps = {
  submission: GradingSubmission;
  assignment: GradingAssignment;
  onSubmitGrade: (grades: QuestionGrade[]) => Promise<void>;
  isSubmitting: boolean;
  hasPreviousSubmission: boolean;
  hasNextSubmission: boolean;
  currentSubmissionIndex: number;
  totalSubmissionCount: number;
  onSelectPreviousSubmission: () => void;
  onSelectNextSubmission: () => void;
};

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  );
}

function buildInitialGrades(
  answers: GradingAnswer[],
  submission: GradingSubmission
): Record<string, QuestionGrade> {
  const initialGrades: Record<string, QuestionGrade> = {};

  const marksByAnswerId = new Map(
    (submission.marks ?? [])
      .filter((mark) => Boolean(mark.answerId))
      .map((mark) => [mark.answerId as string, mark])
  );

  answers.forEach((answer) => {
    const maxPoints = answer.question?.points ?? 0;
    const existingMark = marksByAnswerId.get(answer.id);

    initialGrades[answer.id] = {
      answerId: answer.id,
      questionId: answer.questionId,
      points: existingMark?.points ?? 0,
      maxPoints,
      feedback: existingMark?.feedback ?? '',
    };
  });

  return initialGrades;
}

export function GradingPanel({
  submission,
  assignment,
  onSubmitGrade,
  isSubmitting,
  hasPreviousSubmission,
  hasNextSubmission,
  currentSubmissionIndex,
  totalSubmissionCount,
  onSelectPreviousSubmission,
  onSelectNextSubmission,
}: GradingPanelProps) {
  const answers = useMemo(() => submission.answers ?? [], [submission.answers]);
  const [grades, setGrades] = useState<Record<string, QuestionGrade>>(() =>
    buildInitialGrades(answers, submission)
  );
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(
    () => answers[0]?.questionId ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const pointsInputRef = useRef<HTMLInputElement | null>(null);
  const resolvedActiveQuestionId =
    answers.length === 0
      ? null
      : activeQuestionId && answers.some((answer) => answer.questionId === activeQuestionId)
        ? activeQuestionId
        : answers[0].questionId;

  const activeAnswer = useMemo(() => {
    if (answers.length === 0) return null;

    if (!resolvedActiveQuestionId) {
      return answers[0];
    }

    return answers.find((answer) => answer.questionId === resolvedActiveQuestionId) ?? answers[0];
  }, [answers, resolvedActiveQuestionId]);

  const activeQuestionIndex = useMemo(() => {
    if (!activeAnswer) return -1;
    return answers.findIndex((answer) => answer.questionId === activeAnswer.questionId);
  }, [answers, activeAnswer]);

  const setActiveQuestionByOffset = useCallback(
    (offset: number) => {
      if (activeQuestionIndex < 0) return;

      const nextIndex = activeQuestionIndex + offset;
      if (nextIndex < 0 || nextIndex >= answers.length) return;

      setActiveQuestionId(answers[nextIndex].questionId);
    },
    [activeQuestionIndex, answers]
  );

  const isGraded = submission.status === 'graded';

  // Keyboard-driven rubric scoring state
  const [acceptAITrigger, setAcceptAITrigger] = useState(0);
  const [rubricLevelSelectTrigger, setRubricLevelSelectTrigger] = useState<{
    criterionIndex: number;
    levelIndex: number;
    seq: number;
  } | null>(null);

  // Fetch rubric for the active question to know criterion count for keyboard nav
  const activeQuestionId_forRubric = activeAnswer?.questionId ?? null;
  const { data: rubricData } = useQuery({
    queryKey: ['rubric', activeQuestionId_forRubric],
    queryFn: () => rubricsApi.getByQuestion(activeQuestionId_forRubric!),
    enabled: !!activeQuestionId_forRubric,
    staleTime: 5 * 60 * 1000,
  });

  const rubricCriteriaCount = useMemo(() => {
    const criteria = rubricData?.rubric?.criteria;
    return Array.isArray(criteria) ? criteria.length : 0;
  }, [rubricData]);

  // Derive focused criterion index as a combined key of question + offset
  // Reset offset when question changes by tracking it alongside the offset
  const [focusedCriterionState, setFocusedCriterionState] = useState<{ questionId: string | null; offset: number }>({
    questionId: activeQuestionId_forRubric,
    offset: 0,
  });

  // When the question changes, reset to 0
  const focusedCriterionOffset = focusedCriterionState.questionId === activeQuestionId_forRubric
    ? focusedCriterionState.offset
    : 0;
  const focusedCriterionIndex = rubricCriteriaCount > 0 ? focusedCriterionOffset : null;

  // Ref for save handler to use in keyboard shortcut
  const handleSubmitRef = useRef<((moveToNext?: boolean) => Promise<void>) | undefined>(undefined);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Ctrl+S / Cmd+S to save grades (works even when typing)
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        if (!isGraded && answers.length > 0 && handleSubmitRef.current) {
          void handleSubmitRef.current(false);
        }
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();

      // Tab to cycle between questions
      if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        if (event.shiftKey) {
          setActiveQuestionByOffset(-1);
        } else {
          setActiveQuestionByOffset(1);
        }
        return;
      }

      if (event.key === '[') {
        event.preventDefault();
        setActiveQuestionByOffset(-1);
        return;
      }

      if (event.key === ']') {
        event.preventDefault();
        setActiveQuestionByOffset(1);
        return;
      }

      // Enter / A to accept AI suggestion
      if ((key === 'enter' || key === 'a') && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setAcceptAITrigger((prev) => prev + 1);
        return;
      }

      // Number keys 1-9 to select rubric criterion levels
      if (rubricCriteriaCount > 0 && focusedCriterionIndex !== null) {
        const num = Number.parseInt(event.key, 10);
        if (num >= 1 && num <= 9) {
          event.preventDefault();
          setRubricLevelSelectTrigger({
            criterionIndex: focusedCriterionIndex,
            levelIndex: num - 1,
            seq: Date.now(),
          });
          return;
        }

        // Up/Down arrows to cycle focused criterion
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setFocusedCriterionState((prev) => ({
            questionId: activeQuestionId_forRubric,
            offset: prev.offset > 0 ? prev.offset - 1 : rubricCriteriaCount - 1,
          }));
          return;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setFocusedCriterionState((prev) => ({
            questionId: activeQuestionId_forRubric,
            offset: prev.offset < rubricCriteriaCount - 1 ? prev.offset + 1 : 0,
          }));
          return;
        }
      }

      if (key === 'j' && hasNextSubmission) {
        event.preventDefault();
        onSelectNextSubmission();
        return;
      }

      if (key === 'k' && hasPreviousSubmission) {
        event.preventDefault();
        onSelectPreviousSubmission();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    answers.length,
    isGraded,
    hasNextSubmission,
    hasPreviousSubmission,
    onSelectNextSubmission,
    onSelectPreviousSubmission,
    setActiveQuestionByOffset,
    rubricCriteriaCount,
    focusedCriterionIndex,
    activeQuestionId_forRubric,
  ]);

  useEffect(() => {
    if (isGraded || !activeAnswer) return;

    const rafId = requestAnimationFrame(() => {
      pointsInputRef.current?.focus();
      pointsInputRef.current?.select();
    });

    return () => cancelAnimationFrame(rafId);
  }, [submission.id, activeAnswer, isGraded]);

  const handleGradeChange = (nextGrade: QuestionGrade) => {
    setGrades((prev) => ({
      ...prev,
      [nextGrade.answerId]: nextGrade,
    }));
  };

  const gradeList = useMemo(() => {
    return answers.map((answer) => {
      const maxPoints = answer.question?.points ?? 0;

      return (
        grades[answer.id] ?? {
          answerId: answer.id,
          questionId: answer.questionId,
          points: 0,
          maxPoints,
          feedback: '',
        }
      );
    });
  }, [answers, grades]);

  const handleSubmit = useCallback(async (moveToNextAfterSave = false) => {
    if (answers.length === 0) return;

    setError(null);
    setSuccess(false);

    try {
      await onSubmitGrade(gradeList);
      setSuccess(true);
      if (moveToNextAfterSave && hasNextSubmission) {
        onSelectNextSubmission();
      } else {
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, [answers.length, onSubmitGrade, gradeList, hasNextSubmission, onSelectNextSubmission]);

  // Keep ref updated for keyboard shortcut
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  const totalPoints = gradeList.reduce((sum, grade) => sum + grade.points, 0);
  const maxPoints = answers.reduce((sum, answer) => sum + (answer.question?.points ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {submission.user?.fullName || submission.user?.email || 'Unknown Student'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {assignment.title} • Student {Math.max(currentSubmissionIndex + 1, 1)} of {totalSubmissionCount}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Attempt {submission.attemptNumber} •{' '}
              {submission.submittedAt
                ? `Submitted ${new Date(submission.submittedAt).toLocaleString()}`
                : 'Not submitted'}
            </p>
          </div>

          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">
              {totalPoints} / {maxPoints}
            </p>
            <p className="text-sm text-gray-600">Total score</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onSelectPreviousSubmission}
            disabled={!hasPreviousSubmission}
            className="px-3 py-2 rounded-md border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Previous Student (K)
          </button>
          <button
            type="button"
            onClick={onSelectNextSubmission}
            disabled={!hasNextSubmission}
            className="px-3 py-2 rounded-md border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Next Student (J)
          </button>
        </div>
      </div>

      {/* Tab switch log */}
      {Array.isArray(submission.tabSwitches) && submission.tabSwitches.length > 0 && (
        <TabSwitchLog tabSwitches={submission.tabSwitches as TabSwitchEvent[]} />
      )}

      {answers.length > 0 ? (
        <div className="bg-white shadow rounded-lg p-4">
          <div className="text-sm font-medium text-gray-700 mb-2">Question Navigator</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {answers.map((answer, index) => {
              const questionMaxPoints = answer.question?.points ?? 0;
              const questionGrade = grades[answer.id];
              const questionPoints = questionGrade?.points ?? 0;
              const isActive = activeAnswer?.questionId === answer.questionId;

              return (
                <button
                  key={answer.id}
                  type="button"
                  onClick={() => setActiveQuestionId(answer.questionId)}
                  className={`px-3 py-2 rounded-md border text-sm whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Q{index + 1}: {questionPoints}/{questionMaxPoints}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">Use [/] or Tab/Shift+Tab to move between questions. {rubricCriteriaCount > 0 ? 'Arrow keys to focus criteria, 1-9 to select levels.' : ''}</p>
        </div>
      ) : null}

      {activeAnswer ? (
        <QuestionGradeCard
          key={`${submission.id}:${activeAnswer.id}`}
          answer={activeAnswer as GradingAnswer}
          questionNumber={activeQuestionIndex + 1}
          grade={grades[activeAnswer.id]}
          onGradeChange={handleGradeChange}
          isReadOnly={isGraded}
          pointsInputRef={pointsInputRef}
          existingMark={
            (submission.marks ?? []).find((m) => m.answerId === activeAnswer.id) ?? null
          }
          focusedCriterionIndex={focusedCriterionIndex}
          acceptAITrigger={acceptAITrigger}
          rubricLevelSelectTrigger={rubricLevelSelectTrigger}
        />
      ) : (
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-gray-500 text-center">No answers submitted</p>
        </div>
      )}

      {!isGraded && answers.length > 0 ? (
        <div className="bg-white shadow rounded-lg p-6">
          {error ? (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              Grades submitted successfully.
            </div>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                void handleSubmit(false);
              }}
              disabled={isSubmitting}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Grades'}
            </button>
            <button
              type="button"
              onClick={() => {
                void handleSubmit(true);
              }}
              disabled={isSubmitting || !hasNextSubmission}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save and Next Student'}
            </button>
          </div>
        </div>
      ) : null}

      {isGraded ? (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          This submission has already been graded.
          {submission.gradedAt ? (
            <span className="block text-sm mt-1">
              Graded on {new Date(submission.gradedAt).toLocaleString()}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
