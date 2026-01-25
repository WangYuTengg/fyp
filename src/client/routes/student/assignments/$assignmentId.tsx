import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiRequestError, assignmentsApi, submissionsApi } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';

type AssignmentQuestion = {
  id: string;
  order: number;
  points: number | null;
  question: {
    id: string;
    title: string;
    content: unknown;
    points: number;
    type: 'mcq' | 'written' | 'coding' | 'uml';
  };
};

type AssignmentDetails = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  courseId: string;
  dueDate: string | null;
  questions: AssignmentQuestion[];
};

type Submission = {
  id: string;
  assignmentId: string;
  userId: string;
  status: 'draft' | 'submitted' | 'grading' | 'graded';
};

type AnswerState =
  | { type: 'written'; text: string }
  | { type: 'mcq'; selectedOptionIds: string[] };

function getPrompt(content: unknown): string {
  if (typeof content !== 'object' || content === null) return '';
  const record = content as Record<string, unknown>;
  return typeof record.prompt === 'string' ? record.prompt : '';
}

function getMcqOptions(content: unknown): Array<{ id: string; text: string }> {
  if (typeof content !== 'object' || content === null) return [];
  const record = content as Record<string, unknown>;
  const options = Array.isArray(record.options) ? record.options : [];
  return options
    .map((option) => ({
      id: typeof option?.id === 'string' ? option.id : '',
      text: typeof option?.text === 'string' ? option.text : '',
    }))
    .filter((option) => option.id && option.text);
}

function getWrittenValue(answer?: AnswerState): string {
  return answer?.type === 'written' ? answer.text : '';
}

function isOptionSelected(answer: AnswerState | undefined, optionId: string): boolean {
  return answer?.type === 'mcq' ? answer.selectedOptionIds.includes(optionId) : false;
}

export const Route = createFileRoute('/student/assignments/$assignmentId')({
  component: StudentAssignmentAttempt,
});

function StudentAssignmentAttempt() {
  const { assignmentId } = Route.useParams();
  const { user, dbUser, loading: authLoading, setAdminViewAs } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<AssignmentDetails | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dirtyRef = useRef<Set<string>>(new Set());
  const answersRef = useRef<Record<string, AnswerState>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: '/login' });
    }
    if (!authLoading && dbUser?.role === 'admin') {
      setAdminViewAs('student');
    }
  }, [authLoading, user, navigate, dbUser, setAdminViewAs]);

  useEffect(() => {
    if (!user) return;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const [submissionData, assignmentData] = await Promise.all([
          submissionsApi.start(assignmentId),
          assignmentsApi.getById(assignmentId),
        ]);

        setSubmission(submissionData as Submission);
        setAssignment(assignmentData as AssignmentDetails);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [user, assignmentId]);

  const questions = useMemo(() => assignment?.questions ?? [], [assignment]);
  const questionsById = useMemo(() => {
    const map = new Map<string, AssignmentQuestion['question']>();
    questions.forEach((item) => map.set(item.question.id, item.question));
    return map;
  }, [questions]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const dueDate = assignment?.dueDate ? new Date(assignment.dueDate) : null;
  const isPastDue = dueDate ? Date.now() > dueDate.getTime() : false;

  const isBlockingError = useCallback((err: unknown) => {
    if (err instanceof ApiRequestError) {
      return err.status === 401 || err.status === 403 || err.status === 409 || err.status >= 500;
    }

    return err instanceof TypeError;
  }, []);

  const saveAnswer = useCallback(async (questionId: string, silent = false) => {
    if (!submission || submitted) return;
    const question = questionsById.get(questionId);
    if (!question) return;

    if (isPastDue) {
      showToast('Assignment is past due. You can only submit your last saved answers.');
      return;
    }

    const draft = answersRef.current[questionId];
    const content = question.type === 'mcq'
      ? { selectedOptionIds: draft?.type === 'mcq' ? draft.selectedOptionIds : [] }
      : { text: draft?.type === 'written' ? draft.text : '' };

    try {
      if (!silent) {
        setSaving((prev) => ({ ...prev, [questionId]: true }));
      }
      await submissionsApi.saveAnswer(submission.id, {
        questionId,
        content,
      });
      dirtyRef.current.delete(questionId);
    } catch (err: unknown) {
      if (isBlockingError(err)) {
        const message = err instanceof Error ? err.message : String(err);
        showToast(message);
      }
    } finally {
      if (!silent) {
        setSaving((prev) => ({ ...prev, [questionId]: false }));
      }
    }
  }, [isBlockingError, isPastDue, questionsById, showToast, submission, submitted]);

  useEffect(() => {
    if (!submission || submitted) return;

    const interval = setInterval(() => {
      if (isPastDue) return;
      const dirtyIds = Array.from(dirtyRef.current);
      if (dirtyIds.length === 0) return;
      dirtyIds.forEach((questionId) => {
        void saveAnswer(questionId, true);
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [isPastDue, saveAnswer, submission, submitted]);

  const submit = async () => {
    if (!submission) return;

    try {
      await submissionsApi.submit(submission.id);
      setSubmitted(true);
    } catch (err: unknown) {
      if (isBlockingError(err)) {
        const message = err instanceof Error ? err.message : String(err);
        showToast(message);
      }
    }
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

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-red-600 text-white px-4 py-3 shadow-lg">
          {toast}
        </div>
      )}
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
        {assignment.description && <p className="mt-2 text-gray-600">{assignment.description}</p>}
        {dueDate && (
          <p className="mt-2 text-sm text-gray-500">Due: {dueDate.toLocaleString()}</p>
        )}
        {isPastDue && (
          <div className="mt-4 rounded-md bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">
              Past due. Saving is disabled, but you can still submit your last saved answers.
            </p>
          </div>
        )}
        {submitted && (
          <div className="mt-4 rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-800">Submitted successfully.</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {questions.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-6">
            <p className="text-gray-500">No questions in this assignment yet.</p>
          </div>
        ) : (
          questions.map((aq) => (
            <div key={aq.id} className="bg-white shadow rounded-lg p-6 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {aq.order}. {aq.question.title}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">{getPrompt(aq.question.content)}</p>
                </div>
                <div className="text-sm text-gray-500 whitespace-nowrap">
                  {(aq.points ?? aq.question.points) || 0} pts
                </div>
              </div>

              {aq.question.type === 'written' && (
                <textarea
                  rows={5}
                  value={getWrittenValue(answers[aq.question.id])}
                  onChange={(e) => {
                    const value = e.target.value;
                    setAnswers((prev) => ({
                      ...prev,
                      [aq.question.id]: { type: 'written', text: value },
                    }));
                    dirtyRef.current.add(aq.question.id);
                  }}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Type your answer..."
                  disabled={submitted}
                />
              )}

              {aq.question.type === 'mcq' && (
                <div className="space-y-2">
                  {getMcqOptions(aq.question.content).map((option) => (
                    <label key={option.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="radio"
                        name={`mcq-${aq.question.id}`}
                        checked={isOptionSelected(answers[aq.question.id], option.id)}
                        onChange={() => {
                          setAnswers((prev) => ({
                            ...prev,
                            [aq.question.id]: { type: 'mcq', selectedOptionIds: [option.id] },
                          }));
                          dirtyRef.current.add(aq.question.id);
                        }}
                        disabled={submitted}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span>{option.text}</span>
                    </label>
                  ))}
                </div>
              )}

              {aq.question.type !== 'written' && aq.question.type !== 'mcq' && (
                <p className="text-sm text-gray-500">
                  This question type is not supported yet.
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => saveAnswer(aq.question.id)}
                  disabled={submitted || saving[aq.question.id] || isPastDue}
                  className="bg-blue-500 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded disabled:opacity-50"
                >
                  {saving[aq.question.id] ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
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
