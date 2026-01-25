import { useEffect, useMemo, useState } from 'react';
import { assignmentsApi, submissionsApi } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import type { AssignmentDetails, Submission } from '../types';

export function useAssignmentData(assignmentId: string) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<AssignmentDetails | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);

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
    const map = new Map<string, (typeof questions)[0]['question']>();
    questions.forEach((item) => map.set(item.question.id, item.question));
    return map;
  }, [questions]);

  const dueDate = assignment?.dueDate ? new Date(assignment.dueDate) : null;
  const isPastDue = dueDate ? Date.now() > dueDate.getTime() : false;

  return {
    loading,
    error,
    assignment,
    submission,
    questions,
    questionsById,
    dueDate,
    isPastDue,
  };
}
