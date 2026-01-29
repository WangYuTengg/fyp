import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAssignmentData } from './hooks/useAssignmentData';
import { useAnswerManagement } from './hooks/useAnswerManagement';
import { AssignmentHeader } from './components/AssignmentHeader';
import { QuestionCard } from './components/QuestionCard';
import { Timer } from './components/Timer';
import { submissionsApi } from '../../lib/api';

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

  const hasDirtyAnswers = useRef(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Track if there are unsaved changes
  useEffect(() => {
    hasDirtyAnswers.current = Object.keys(answers).some((questionId) => {
      const answer = answers[questionId];
      const savedAnswer = submission?.answers?.find((a) => a.questionId === questionId);
      
      if (!answer || !savedAnswer) return true; // New answer not yet saved
      
      if (answer.type === 'mcq' && savedAnswer.content.selectedOptionIds) {
        return JSON.stringify(answer.selectedOptionIds) !== JSON.stringify(savedAnswer.content.selectedOptionIds);
      } else if (answer.type === 'uml') {
        const umlChanged = answer.umlText !== savedAnswer.content.umlText;
        const editorChanged = JSON.stringify(answer.editorState ?? null) !== JSON.stringify(savedAnswer.content.editorState ?? null);
        return umlChanged || editorChanged;
      } else if (answer.type === 'written') {
        return answer.text !== savedAnswer.content.text;
      }
      return false;
    });
  }, [answers, submission]);

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
          onClick={submit}
          disabled={submitted || !submission}
          className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
        >
          Submit assignment
        </button>
      </div>
    </div>
  );
}
