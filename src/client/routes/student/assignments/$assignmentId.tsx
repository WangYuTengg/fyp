import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { assignmentsApi, submissionsApi } from '../../../lib/api';
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
  questions: AssignmentQuestion[];
};

type Submission = {
  id: string;
  assignmentId: string;
  userId: string;
  status: 'draft' | 'submitted' | 'grading' | 'graded';
};

function getPrompt(content: unknown): string {
  if (typeof content !== 'object' || content === null) return '';
  const record = content as Record<string, unknown>;
  return typeof record.prompt === 'string' ? record.prompt : '';
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
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

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

  const saveAnswer = async (questionId: string) => {
    if (!submission) return;

    try {
      setSaving((prev) => ({ ...prev, [questionId]: true }));
      await submissionsApi.saveAnswer(submission.id, {
        questionId,
        content: { text: answers[questionId] ?? '' },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to save answer: ' + message);
    } finally {
      setSaving((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  const submit = async () => {
    if (!submission) return;

    try {
      await submissionsApi.submit(submission.id);
      setSubmitted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to submit: ' + message);
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
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
        {assignment.description && <p className="mt-2 text-gray-600">{assignment.description}</p>}
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

              <textarea
                rows={5}
                value={answers[aq.question.id] ?? ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [aq.question.id]: e.target.value }))}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Type your answer..."
                disabled={submitted}
              />

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => saveAnswer(aq.question.id)}
                  disabled={submitted || saving[aq.question.id]}
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
