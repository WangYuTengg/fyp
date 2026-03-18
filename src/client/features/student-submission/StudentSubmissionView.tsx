import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '../../lib/api';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowLeftIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

type Mark = {
  id: string;
  points: number;
  maxPoints: number;
  feedback: string | null;
  isAiAssisted: boolean;
  aiSuggestionAccepted: boolean;
};

type QuestionContent = {
  prompt?: string;
  options?: Array<{ id: string; text: string; isCorrect?: boolean }>;
  allowMultiple?: boolean;
  referenceDiagram?: string;
  modelAnswer?: string;
};

type AnswerWithMark = {
  id: string;
  questionId: string;
  content: {
    text?: string;
    selectedOptionIds?: string[];
    umlText?: string;
  };
  aiGradingSuggestion?: {
    points: number;
    reasoning: string;
    confidence: number;
    criteriaScores?: { criterion: string; score: number; comment: string }[];
  } | null;
  mark?: Mark | null;
  question: {
    id: string;
    title: string;
    type: 'mcq' | 'written' | 'uml';
    points: number;
    content: QuestionContent;
  };
};

type SubmissionDetails = {
  id: string;
  assignmentId: string;
  status: 'draft' | 'submitted' | 'late' | 'grading' | 'graded';
  startedAt: string;
  submittedAt?: string;
  assignment: {
    id: string;
    title: string;
    courseId: string;
    course: {
      id: string;
      code: string;
      name: string;
    };
  };
  answers: AnswerWithMark[];
  totalPoints?: number;
  earnedPoints?: number;
};

export function StudentSubmissionView({ submissionId }: { submissionId: string }) {
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<SubmissionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubmission = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient<SubmissionDetails>(`/api/submissions/${submissionId}/results`);
      setSubmission(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submission');
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    fetchSubmission();
  }, [fetchSubmission]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Submission not found'}
        </div>
      </div>
    );
  }

  const isGraded = submission.status === 'graded';
  const totalPoints = submission.totalPoints || submission.answers.reduce((sum, a) => sum + a.question.points, 0);
  const earnedPoints = submission.earnedPoints || submission.answers.reduce((sum, a) => sum + (a.mark?.points || 0), 0);
  const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'graded':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-sm rounded-full">Graded</span>;
      case 'grading':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full">Grading in Progress</span>;
      case 'submitted':
      case 'late':
        return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">Submitted</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-sm rounded-full">{status}</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => navigate({ to: '/student' })}
            className="flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{submission.assignment.title}</h1>
          <p className="text-gray-600">
            {submission.assignment.course.code} - {submission.assignment.course.name}
          </p>
        </div>
        {getStatusBadge(submission.status)}
      </div>

      {/* Grade Summary */}
      {isGraded && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Grade Summary</h2>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className={`text-4xl font-bold ${percentage >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                {earnedPoints}/{totalPoints}
              </div>
              <div className="text-gray-500">Points</div>
            </div>
            <div className="text-center">
              <div className={`text-4xl font-bold ${percentage >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                {percentage}%
              </div>
              <div className="text-gray-500">Score</div>
            </div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${percentage >= 50 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Answers & Feedback */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Your Answers</h2>

        {submission.answers.map((answer, idx) => (
          <div key={answer.id} className="bg-white shadow rounded-lg overflow-hidden">
            {/* Question Header */}
            <div className="bg-gray-50 px-6 py-3 border-b flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-500">Question {idx + 1}</span>
                <h3 className="font-medium">{answer.question.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                {answer.mark ? (
                  <>
                    {answer.mark.points === answer.mark.maxPoints ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    ) : answer.mark.points <= 0 ? (
                      <XCircleIcon className="h-5 w-5 text-red-500" />
                    ) : (
                      <ClockIcon className="h-5 w-5 text-yellow-500" />
                    )}
                    <span className="font-medium">
                      {answer.mark.points}/{answer.mark.maxPoints}
                    </span>
                    {answer.mark.isAiAssisted && (
                      <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                        <SparklesIcon className="h-3 w-3" />
                        AI-Assisted
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-400">Not graded yet</span>
                )}
              </div>
            </div>

            {/* Answer Content */}
            <div className="px-6 py-4">
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-500 mb-2">Your Answer:</h4>
                {answer.question.type === 'mcq' && answer.content.selectedOptionIds && (
                  <div className="space-y-2">
                    {(answer.question.content as { options: { id: string; text: string }[] }).options.map((opt) => {
                      const isSelected = answer.content.selectedOptionIds?.includes(opt.id);
                      return (
                        <div
                          key={opt.id}
                          className={`p-2 rounded border ${
                            isSelected ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          {isSelected && '✓ '}{opt.text}
                        </div>
                      );
                    })}
                  </div>
                )}
                {answer.question.type === 'written' && (
                  <div className="bg-gray-50 p-4 rounded whitespace-pre-wrap">
                    {answer.content.text || <span className="text-gray-400 italic">No answer provided</span>}
                  </div>
                )}
                {answer.question.type === 'uml' && (
                  <div>
                    {answer.content.umlText && (
                      <pre className="bg-gray-800 text-gray-100 p-4 rounded text-sm overflow-x-auto">
                        {answer.content.umlText}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              {/* Feedback */}
              {answer.mark?.feedback && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Feedback:</h4>
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded text-gray-800 whitespace-pre-wrap">
                    {answer.mark.feedback}
                  </div>
                </div>
              )}

              {/* AI Suggestion (for debugging/transparency, optional) */}
              {answer.aiGradingSuggestion && !answer.mark && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <SparklesIcon className="h-5 w-5 text-purple-600" />
                    <h4 className="text-sm font-medium text-purple-600">AI Grading Pending Review</h4>
                  </div>
                  <p className="text-sm text-gray-500">
                    This answer has been analyzed by AI and is awaiting instructor review.
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
