import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAssignmentData } from './hooks/useAssignmentData';
import { useAnswerManagement } from './hooks/useAnswerManagement';
import { AssignmentHeader } from './components/AssignmentHeader';
import { QuestionCard } from './components/QuestionCard';

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
  } = useAssignmentData(assignmentId);

  const {
    answers,
    saving,
    submitted,
    toast,
    saveAnswer,
    submit,
    updateAnswer,
  } = useAnswerManagement(submission, questionsById, isPastDue);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: '/login' });
    }
    if (!authLoading && dbUser?.role === 'admin') {
      setAdminViewAs('student');
    }
  }, [authLoading, user, navigate, dbUser, setAdminViewAs]);

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

  return (
    <div className="space-y-6">
      <AssignmentHeader
        assignment={assignment}
        dueDate={dueDate}
        isPastDue={isPastDue}
        submitted={submitted}
        toast={toast}
      />

      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-gray-500">No questions in this assignment yet.</p>
          </div>
        ) : (
          questions.map((aq) => (
            <QuestionCard
              key={aq.id}
              assignmentQuestion={aq}
              answer={answers[aq.question.id]}
              onUpdateAnswer={updateAnswer}
              onSave={saveAnswer}
              isSaving={saving[aq.question.id] ?? false}
              isSubmitted={submitted}
              isPastDue={isPastDue}
            />
          ))
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
