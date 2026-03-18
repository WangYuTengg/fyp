import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAssignmentData } from './hooks/useAssignmentData';
import { useAnswerManagement } from './hooks/useAnswerManagement';
import { useFocusMonitor } from './hooks/useFocusMonitor';
import { AssignmentHeader } from './components/AssignmentHeader';
import { QuestionCard } from './components/QuestionCard';
import { Timer } from './components/Timer';
import { submissionsApi } from '../../lib/api';
import { Modal } from '../../components/Modal';
import type { Answer } from './types';

type StudentAssignmentAttemptProps = {
  assignmentId: string;
};

export function StudentAssignmentAttempt({ assignmentId }: StudentAssignmentAttemptProps) {
  const { user, dbUser, loading: authLoading, setAdminViewAs } = useAuth();
  const navigate = useNavigate();

  const {
    loading,
    error,
    assignment,
    submission,
    questions,
    questionsById,
    dueDate,
    isPastDue,
    refreshSubmission,
  } = useAssignmentData(assignmentId);

  const {
    answers,
    saving,
    submitted,
    toast,
    lastSaved,
    saveAnswer,
    submit,
    updateAnswer,
  } = useAnswerManagement(submission, questionsById, isPastDue);

  const handleFocusAutoSubmit = useCallback(() => {
    if (!submitted && submission) {
      submit();
    }
  }, [submitted, submission, submit]);

  const { showWarning: showFocusWarning, dismissWarning: dismissFocusWarning } = useFocusMonitor({
    submissionId: submission?.id,
    monitorFocus: assignment?.monitorFocus ?? false,
    maxTabSwitches: assignment?.maxTabSwitches ?? null,
    isSubmitted: submitted,
    onAutoSubmit: handleFocusAutoSubmit,
  });

  const hasDirtyAnswers = useRef(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);

  const savedAnswersByQuestionId = useMemo(() => {
    const map = new Map<string, Answer>();
    submission?.answers?.forEach((answer) => {
      map.set(answer.questionId, answer);
    });
    return map;
  }, [submission?.answers]);

  const unsavedQuestionIds = useMemo(() => {
    return Object.keys(answers).filter((questionId) => {
      const answer = answers[questionId];
      const savedAnswer = savedAnswersByQuestionId.get(questionId);

      if (!answer || !savedAnswer) return true;

      if (answer.type === 'mcq') {
        const selectedOptionIds = savedAnswer.content.selectedOptionIds ?? [];
        return JSON.stringify(answer.selectedOptionIds) !== JSON.stringify(selectedOptionIds);
      }

      if (answer.type === 'uml') {
        const umlChanged = answer.umlText !== (savedAnswer.content.umlText ?? '');
        const editorChanged = JSON.stringify(answer.editorState ?? null) !== JSON.stringify(savedAnswer.content.editorState ?? null);
        return umlChanged || editorChanged;
      }

      if (answer.type === 'coding') {
        return answer.text !== (savedAnswer.content.text ?? '');
      }

      return answer.text !== (savedAnswer.content.text ?? '');
    });
  }, [answers, savedAnswersByQuestionId]);

  const unansweredCount = useMemo(() => {
    return questions.filter(({ question }) => {
      const answer = answers[question.id];
      const savedAnswer = savedAnswersByQuestionId.get(question.id);

      if (answer?.type === 'written') {
        return answer.text.trim().length === 0;
      }

      if (answer?.type === 'coding') {
        return answer.text.trim().length === 0;
      }

      if (answer?.type === 'mcq') {
        return answer.selectedOptionIds.length === 0;
      }

      if (answer?.type === 'uml') {
        return answer.umlText.trim().length === 0 && !savedAnswer?.fileUrl;
      }

      if (savedAnswer?.content.text !== undefined) {
        return savedAnswer.content.text.trim().length === 0;
      }

      if (savedAnswer?.content.selectedOptionIds) {
        return savedAnswer.content.selectedOptionIds.length === 0;
      }

      if (savedAnswer?.content.umlText !== undefined || savedAnswer?.fileUrl) {
        return (savedAnswer.content.umlText ?? '').trim().length === 0 && !savedAnswer.fileUrl;
      }

      return true;
    }).length;
  }, [answers, questions, savedAnswersByQuestionId]);

  // Track if there are unsaved changes
  useEffect(() => {
    hasDirtyAnswers.current = unsavedQuestionIds.length > 0;
  }, [unsavedQuestionIds]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (submitted) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasDirtyAnswers.current) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [submitted]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: '/login' });
    }
    if (!authLoading && dbUser?.role === 'admin') {
      setAdminViewAs('student');
    }
  }, [authLoading, user, navigate, dbUser, setAdminViewAs]);

  // Auto-submit when time runs out
  const handleTimeUp = () => {
    if (!submitted && submission) {
      alert('⏰ Time is up! Submitting your assignment...');
      submit();
    }
  };

  // Handle file upload for UML questions
  const handleFileUpload = async (questionId: string, file: File) => {
    if (!submission) {
      throw new Error('No active submission');
    }

    await submissionsApi.uploadFile(submission.id, questionId, file);
    
    // Refresh submission data to get updated file URL
    await refreshSubmission();
  };

  if (loading) {
    return <div className="text-center py-8">Loading assignment...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        Error: {error}
      </div>
    );
  }

  if (!assignment) {
    return <div className="text-center py-8">Assignment not found</div>;
  }

  const hasTimeLimit = assignment.timeLimit && submission;

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentQuestionIndex];

  const goToNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const openSubmitConfirm = () => {
    if (submitted || !submission) return;
    setIsSubmitConfirmOpen(true);
  };

  const closeSubmitConfirm = () => {
    setIsSubmitConfirmOpen(false);
  };

  const confirmSubmit = async () => {
    await submit();
    setIsSubmitConfirmOpen(false);
  };

  return (
    <div className="space-y-6">
      <AssignmentHeader
        assignment={assignment}
        dueDate={dueDate}
        isPastDue={isPastDue}
        submitted={submitted}
        toast={toast}
        lastSaved={lastSaved}
        isSaving={Object.values(saving).some((s) => s)}
      />

      {/* Timer */}
      {hasTimeLimit && !submitted && submission?.startedAt && assignment.timeLimit && (
        <div className="flex justify-center">
          <Timer
            startedAt={submission.startedAt}
            timeLimitMinutes={assignment.timeLimit}
            onTimeUp={handleTimeUp}
          />
        </div>
      )}

      {/* Focus monitoring warning toast */}
      {showFocusWarning && (
        <div className="fixed top-4 right-4 z-50 max-w-sm animate-in slide-in-from-top">
          <div className="bg-amber-50 border border-amber-300 rounded-lg shadow-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-amber-600 text-lg flex-shrink-0">!</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">Your activity is being monitored</p>
                <p className="text-xs text-amber-700 mt-1">
                  Leaving this tab is being recorded and will be visible to your instructor.
                </p>
              </div>
              <button
                type="button"
                onClick={dismissFocusWarning}
                className="text-amber-600 hover:text-amber-800 text-sm flex-shrink-0"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Progress Indicator */}
      {totalQuestions > 0 && (
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={goToPreviousQuestion}
                disabled={currentQuestionIndex === 0}
                className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={goToNextQuestion}
                disabled={currentQuestionIndex === totalQuestions - 1}
                className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-gray-500">No questions in this assignment yet.</p>
          </div>
        ) : (
          currentQuestion && (
            <QuestionCard
              key={currentQuestion.id}
              assignmentQuestion={currentQuestion}
              answer={answers[currentQuestion.question.id]}
              onUpdateAnswer={updateAnswer}
              onSave={saveAnswer}
              onFileUpload={handleFileUpload}
              isSaving={saving[currentQuestion.question.id] ?? false}
              isSubmitted={submitted}
              isPastDue={isPastDue}
              currentFileUrl={submission?.answers?.find((a) => a.questionId === currentQuestion.question.id)?.fileUrl}
            />
          )
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={openSubmitConfirm}
          disabled={submitted || !submission}
          className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
        >
          Submit assignment
        </button>
      </div>

      <Modal
        isOpen={isSubmitConfirmOpen}
        onClose={closeSubmitConfirm}
        title="Confirm submission"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Submitting now will lock your answers. You won&apos;t be able to edit this assignment afterward.
          </p>

          {(unansweredCount > 0 || unsavedQuestionIds.length > 0) && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 space-y-1">
              <p className="font-medium">You still have unfinished work:</p>
              {unansweredCount > 0 && (
                <p>{unansweredCount} question{unansweredCount === 1 ? '' : 's'} unanswered.</p>
              )}
              {unsavedQuestionIds.length > 0 && (
                <p>{unsavedQuestionIds.length} question{unsavedQuestionIds.length === 1 ? '' : 's'} with unsaved changes.</p>
              )}
            </div>
          )}

          <p className="text-sm text-gray-600">
            Review your answers before continuing.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={closeSubmitConfirm}
              className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmSubmit}
              className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
            >
              Submit anyway
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
