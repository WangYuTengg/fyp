import { useState, useEffect, useCallback } from 'react';
import type { GradingSubmission, GradingAssignment, QuestionGrade } from '../types';
import { QuestionGradeCard } from './QuestionGradeCard';

type GradingPanelProps = {
  submission: GradingSubmission;
  assignment: GradingAssignment;
  onSubmitGrade: (grades: QuestionGrade[]) => Promise<void>;
  isSubmitting: boolean;
};

export function GradingPanel({
  submission,
  onSubmitGrade,
  isSubmitting,
}: GradingPanelProps) {
  const [grades, setGrades] = useState<Record<string, QuestionGrade>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize grades from existing marks or answers
  const initializeGrades = useCallback(() => {
    const initialGrades: Record<string, QuestionGrade> = {};
    
    if (submission.marks && submission.marks.length > 0) {
      submission.marks.forEach((mark) => {
        initialGrades[mark.questionId] = {
          questionId: mark.questionId,
          points: mark.points,
          feedback: mark.feedback || '',
        };
      });
    } else if (submission.answers) {
      submission.answers.forEach((answer) => {
        initialGrades[answer.questionId] = {
          questionId: answer.questionId,
          points: 0,
          feedback: '',
        };
      });
    }
    
    return initialGrades;
  }, [submission]);

  // Update grades when submission changes
  useEffect(() => {
    setGrades(initializeGrades());
  }, [initializeGrades]);

  const handleGradeChange = (questionId: string, grade: QuestionGrade) => {
    setGrades((prev) => ({
      ...prev,
      [questionId]: grade,
    }));
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);

    try {
      const gradeList = Object.values(grades);
      await onSubmitGrade(gradeList);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  const totalPoints = Object.values(grades).reduce((sum, g) => sum + g.points, 0);
  const maxPoints =
    submission.answers?.reduce((sum, answer) => sum + (answer.question?.points || 0), 0) || 0;

  const isGraded = submission.status === 'graded';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {submission.user?.fullName || submission.user?.email || 'Unknown Student'}
            </h2>
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
            <p className="text-sm text-gray-600">Total Score</p>
          </div>
        </div>
      </div>

      {/* Answers */}
      <div className="space-y-4">
        {submission.answers && submission.answers.length > 0 ? (
          submission.answers.map((answer, index) => (
            <QuestionGradeCard
              key={answer.id}
              answer={answer}
              questionNumber={index + 1}
              grade={grades[answer.questionId]}
              onGradeChange={handleGradeChange}
              isReadOnly={isGraded}
            />
          ))
        ) : (
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-gray-500 text-center">No answers submitted</p>
          </div>
        )}
      </div>

      {/* Submit Button */}
      {!isGraded && submission.answers && submission.answers.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              Grades submitted successfully!
            </div>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Grades'}
          </button>
        </div>
      )}

      {isGraded && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          This submission has been graded.
          {submission.gradedAt && (
            <span className="block text-sm mt-1">
              Graded on {new Date(submission.gradedAt).toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
