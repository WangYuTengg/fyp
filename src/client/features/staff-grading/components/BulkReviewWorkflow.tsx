import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { apiClient, autoGradeApi } from '../../../lib/api';
import { UMLViewer } from '../../../components/UMLViewer';
import {
  CheckCircleIcon,
  XCircleIcon,
  QuestionMarkCircleIcon,
  ArrowLeftIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

type ReviewAnswer = {
  id: string;
  submissionId: string;
  questionId: string;
  content: Record<string, unknown>;
  fileUrl: string | null;
  aiGradingSuggestion: {
    points?: number;
    reasoning?: string;
    confidence?: number | null;
    criteriaScores?: Record<string, unknown>;
    model?: string;
  } | null;
  question: {
    id: string;
    title: string;
    type: 'mcq' | 'written' | 'coding' | 'uml';
    content: Record<string, unknown>;
    points: number;
  };
  student: {
    name: string | null;
    email: string;
  };
};

type Decision = 'accept' | 'reject' | null;

type ReviewState = {
  answers: ReviewAnswer[];
  decisions: Record<string, Decision>;
  currentIndex: number;
  filter: 'all' | 'pending' | 'low_confidence';
};

type ReviewAction =
  | { type: 'SET_ANSWERS'; answers: ReviewAnswer[] }
  | { type: 'SET_DECISION'; answerId: string; decision: Decision }
  | { type: 'NAVIGATE'; index: number }
  | { type: 'SET_FILTER'; filter: ReviewState['filter'] }
  | { type: 'ACCEPT_ALL_REMAINING' };

function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case 'SET_ANSWERS':
      return { ...state, answers: action.answers, currentIndex: 0 };
    case 'SET_DECISION':
      return {
        ...state,
        decisions: { ...state.decisions, [action.answerId]: action.decision },
      };
    case 'NAVIGATE':
      return {
        ...state,
        currentIndex: Math.max(0, Math.min(action.index, state.answers.length - 1)),
      };
    case 'SET_FILTER':
      return { ...state, filter: action.filter, currentIndex: 0 };
    case 'ACCEPT_ALL_REMAINING':
      const newDecisions = { ...state.decisions };
      state.answers.forEach((a) => {
        if (!newDecisions[a.id]) {
          newDecisions[a.id] = 'accept';
        }
      });
      return { ...state, decisions: newDecisions };
    default:
      return state;
  }
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  );
}

export function BulkReviewWorkflow() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { assignmentId: string };
  const { assignmentId } = search;

  const [state, dispatch] = useReducer(reviewReducer, {
    answers: [],
    decisions: {},
    currentIndex: 0,
    filter: 'all',
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAcceptAllConfirm, setShowAcceptAllConfirm] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ accepted: number; skipped: number } | null>(null);

  // Load answers with AI suggestions that haven't been reviewed yet
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await apiClient<{ answers: ReviewAnswer[] }>(
          `/api/auto-grade/review-queue?assignmentId=${assignmentId}`
        );
        dispatch({ type: 'SET_ANSWERS', answers: data.answers || [] });
      } catch (err: unknown) {
        // Fallback: load all submissions and filter client-side
        try {
          const submissions = await apiClient<Array<{
            id: string;
            answers: Array<{
              id: string;
              submissionId: string;
              questionId: string;
              content: Record<string, unknown>;
              fileUrl: string | null;
              aiGradingSuggestion: unknown;
              question: { id: string; title: string; type: string; content: Record<string, unknown>; points: number };
            }>;
            marks: Array<{ answerId: string }>;
            user: { email: string; fullName: string | null };
          }>>(
            `/api/submissions/assignment/${assignmentId}`
          );

          const reviewAnswers: ReviewAnswer[] = [];

          for (const sub of submissions) {
            if (!sub.answers) continue;
            const markedAnswerIds = new Set((sub.marks || []).map((m) => m.answerId));

            for (const a of sub.answers) {
              if (a.aiGradingSuggestion && !markedAnswerIds.has(a.id)) {
                let suggestion = a.aiGradingSuggestion;
                if (typeof suggestion === 'string') {
                  try { suggestion = JSON.parse(suggestion); } catch { suggestion = null; }
                }
                if (suggestion) {
                  reviewAnswers.push({
                    ...a,
                    aiGradingSuggestion: suggestion as ReviewAnswer['aiGradingSuggestion'],
                    question: a.question as ReviewAnswer['question'],
                    student: {
                      name: sub.user?.fullName || null,
                      email: sub.user?.email || '',
                    },
                  });
                }
              }
            }
          }

          dispatch({ type: 'SET_ANSWERS', answers: reviewAnswers });
        } catch (fallbackErr: unknown) {
          setError(fallbackErr instanceof Error ? fallbackErr.message : 'Failed to load review queue');
        }
      } finally {
        setLoading(false);
      }
    }

    if (assignmentId) void load();
  }, [assignmentId]);

  // Filter answers
  const filteredAnswers = useMemo(() => {
    return state.answers.filter((a) => {
      if (state.filter === 'pending') return !state.decisions[a.id];
      if (state.filter === 'low_confidence') {
        const conf = a.aiGradingSuggestion?.confidence;
        return typeof conf === 'number' && conf < 0.6;
      }
      return true;
    });
  }, [state.answers, state.filter, state.decisions]);

  const currentAnswer = filteredAnswers[state.currentIndex] ?? null;

  const reviewedCount = Object.values(state.decisions).filter(Boolean).length;
  const totalCount = state.answers.length;
  const acceptedIds = Object.entries(state.decisions)
    .filter(([, d]) => d === 'accept')
    .map(([id]) => id);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();

      if (key === 'j' || key === 'arrowdown') {
        event.preventDefault();
        dispatch({ type: 'NAVIGATE', index: state.currentIndex + 1 });
        return;
      }

      if (key === 'k' || key === 'arrowup') {
        event.preventDefault();
        dispatch({ type: 'NAVIGATE', index: state.currentIndex - 1 });
        return;
      }

      if (key === 'a' && !event.shiftKey && currentAnswer) {
        event.preventDefault();
        dispatch({ type: 'SET_DECISION', answerId: currentAnswer.id, decision: 'accept' });
        // Auto-advance
        if (state.currentIndex < filteredAnswers.length - 1) {
          dispatch({ type: 'NAVIGATE', index: state.currentIndex + 1 });
        }
        return;
      }

      if (key === 'r' && currentAnswer) {
        event.preventDefault();
        dispatch({ type: 'SET_DECISION', answerId: currentAnswer.id, decision: 'reject' });
        if (state.currentIndex < filteredAnswers.length - 1) {
          dispatch({ type: 'NAVIGATE', index: state.currentIndex + 1 });
        }
        return;
      }

      if (key === 'a' && event.shiftKey) {
        event.preventDefault();
        setShowAcceptAllConfirm(true);
        return;
      }

      if (key === '?') {
        event.preventDefault();
        setShowShortcutHelp((prev) => !prev);
        return;
      }

      if (key === 'enter' && currentAnswer) {
        event.preventDefault();
        // Confirm current decision and advance
        if (state.currentIndex < filteredAnswers.length - 1) {
          dispatch({ type: 'NAVIGATE', index: state.currentIndex + 1 });
        }
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.currentIndex, currentAnswer, filteredAnswers.length]);

  const handleSubmit = async () => {
    if (acceptedIds.length === 0) return;

    try {
      setSubmitting(true);
      setError(null);
      const result = await autoGradeApi.batchAccept(acceptedIds);
      setSubmitResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const getConfidenceColor = (confidence: number | null | undefined) => {
    if (typeof confidence !== 'number') return 'text-gray-500';
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceBg = (confidence: number | null | undefined) => {
    if (typeof confidence !== 'number') return 'bg-gray-100';
    if (confidence >= 0.8) return 'bg-green-100';
    if (confidence >= 0.6) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-gray-500">Loading review queue...</div>
      </div>
    );
  }

  if (submitResult) {
    return (
      <div className="max-w-lg mx-auto py-16">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <CheckCircleIcon className="h-12 w-12 text-green-600 mx-auto mb-3" />
          <h2 className="text-xl font-semibold text-green-800 mb-2">Review Complete</h2>
          <p className="text-green-700">
            {submitResult.accepted} grades accepted, {submitResult.skipped} skipped.
          </p>
          <button
            type="button"
            onClick={() =>
              navigate({
                to: '/staff/grading',
                search: { assignmentId },
              })
            }
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
          >
            Back to Grading
          </button>
        </div>
      </div>
    );
  }

  if (state.answers.length === 0) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <CheckCircleIcon className="h-12 w-12 text-green-400 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">No AI Suggestions to Review</h2>
        <p className="text-gray-500 mb-4">All AI suggestions have already been reviewed.</p>
        <button
          type="button"
          onClick={() => navigate({ to: '/staff/grading', search: { assignmentId } })}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          Back to Grading
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate({ to: '/staff/grading', search: { assignmentId } })}
            className="text-gray-500 hover:text-gray-700"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-semibold text-gray-900">AI Suggestion Review</h1>
            <p className="text-xs text-gray-500">
              {reviewedCount}/{totalCount} reviewed • {acceptedIds.length} accepted
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter controls */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            {(['all', 'pending', 'low_confidence'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => dispatch({ type: 'SET_FILTER', filter: f })}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  state.filter === f
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : 'Low Confidence'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowShortcutHelp((p) => !p)}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            ?
          </button>

          {acceptedIds.length > 0 ? (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : `Submit ${acceptedIds.length} Accepted`}
            </button>
          ) : null}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-200 shrink-0">
        <div
          className="h-full bg-green-500 transition-all"
          style={{ width: `${totalCount > 0 ? (reviewedCount / totalCount) * 100 : 0}%` }}
        />
      </div>

      {error ? (
        <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-2 text-sm">{error}</div>
      ) : null}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4">
        {currentAnswer ? (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Position indicator */}
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>
                {state.currentIndex + 1} of {filteredAnswers.length}
                {state.filter !== 'all' ? ` (filtered: ${state.filter})` : ''}
              </span>
              <span>
                {currentAnswer.student.name || currentAnswer.student.email} —{' '}
                {currentAnswer.question.title}
              </span>
            </div>

            {/* Question + Student Answer */}
            <div className="bg-white rounded-lg shadow p-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {currentAnswer.question.title}
              </h2>
              {currentAnswer.question.content.prompt &&
              typeof currentAnswer.question.content.prompt === 'string' ? (
                <p className="text-sm text-gray-600 mb-3">{currentAnswer.question.content.prompt}</p>
              ) : null}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Student answer */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Student Answer</h3>
                  <div className="bg-gray-50 rounded p-4">
                    {currentAnswer.question.type === 'uml' &&
                    typeof currentAnswer.content.umlText === 'string' ? (
                      <UMLViewer umlText={currentAnswer.content.umlText} />
                    ) : (
                      <div className="whitespace-pre-wrap text-sm text-gray-800">
                        {(currentAnswer.content.text as string) || 'No answer'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Model answer */}
                <div>
                  <h3 className="text-sm font-medium text-green-700 mb-2">Model Answer</h3>
                  <div className="bg-green-50 rounded p-4 border border-green-200">
                    {currentAnswer.question.type === 'uml' &&
                    typeof currentAnswer.question.content.modelAnswer === 'string' ? (
                      <UMLViewer umlText={currentAnswer.question.content.modelAnswer} />
                    ) : (
                      <div className="whitespace-pre-wrap text-sm text-gray-800">
                        {(currentAnswer.question.content.modelAnswer as string) || 'No model answer'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Suggestion */}
            <div className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center gap-2 mb-3">
                <SparklesIcon className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">AI Suggestion</h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getConfidenceBg(
                    currentAnswer.aiGradingSuggestion?.confidence
                  )} ${getConfidenceColor(currentAnswer.aiGradingSuggestion?.confidence)}`}
                >
                  {typeof currentAnswer.aiGradingSuggestion?.confidence === 'number'
                    ? `${Math.round(currentAnswer.aiGradingSuggestion.confidence * 100)}%`
                    : 'N/A'}
                </span>
              </div>

              <div className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-sm">
                <span className="text-gray-500">Points</span>
                <span className="font-bold text-lg text-blue-700">
                  {Math.round(currentAnswer.aiGradingSuggestion?.points ?? 0)} /{' '}
                  {currentAnswer.question.points}
                </span>

                <span className="text-gray-500">Reasoning</span>
                <div className="bg-gray-50 rounded p-3 whitespace-pre-wrap text-gray-700 max-h-32 overflow-y-auto">
                  {currentAnswer.aiGradingSuggestion?.reasoning || 'No reasoning'}
                </div>
              </div>
            </div>

            {/* Decision buttons */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'SET_DECISION', answerId: currentAnswer.id, decision: 'accept' });
                    if (state.currentIndex < filteredAnswers.length - 1) {
                      dispatch({ type: 'NAVIGATE', index: state.currentIndex + 1 });
                    }
                  }}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-colors ${
                    state.decisions[currentAnswer.id] === 'accept'
                      ? 'bg-green-600 text-white'
                      : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                  }`}
                >
                  <CheckCircleIcon className="h-5 w-5" />
                  Accept (A)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'SET_DECISION', answerId: currentAnswer.id, decision: 'reject' });
                    if (state.currentIndex < filteredAnswers.length - 1) {
                      dispatch({ type: 'NAVIGATE', index: state.currentIndex + 1 });
                    }
                  }}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-colors ${
                    state.decisions[currentAnswer.id] === 'reject'
                      ? 'bg-red-600 text-white'
                      : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                  }`}
                >
                  <XCircleIcon className="h-5 w-5" />
                  Reject (R)
                </button>
                <button
                  type="button"
                  onClick={() => setShowAcceptAllConfirm(true)}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                >
                  Accept All Remaining (Shift+A)
                </button>
              </div>

              {/* Navigation hint */}
              <div className="text-center mt-3 text-xs text-gray-400">
                J/K or arrow keys to navigate • Enter to advance • ? for help
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            No answers match the current filter.
          </div>
        )}
      </div>

      {/* Accept All confirmation modal */}
      {showAcceptAllConfirm ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Accept All Remaining?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will accept all {totalCount - reviewedCount} unreviewed AI suggestions.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAcceptAllConfirm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: 'ACCEPT_ALL_REMAINING' });
                  setShowAcceptAllConfirm(false);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Shortcut help overlay */}
      {showShortcutHelp ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowShortcutHelp(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Keyboard Shortcuts</h3>
            <div className="space-y-2 text-sm">
              {[
                ['J / ↓', 'Next answer'],
                ['K / ↑', 'Previous answer'],
                ['A', 'Accept + advance'],
                ['R', 'Reject + advance'],
                ['Shift+A', 'Accept all remaining'],
                ['Enter', 'Advance to next'],
                ['?', 'Toggle this help'],
              ].map(([key, desc]) => (
                <div key={key} className="flex justify-between">
                  <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">{key}</kbd>
                  <span className="text-gray-600">{desc}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowShortcutHelp(false)}
              className="mt-4 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
