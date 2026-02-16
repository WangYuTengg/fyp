import { useCallback, useEffect, useState } from 'react';
import { assignmentsApi, submissionsApi } from '../../../lib/api';
import type { GradingAssignment, GradingSubmission, QuestionGrade } from '../types';

export function useGrading(assignmentId: string, initialSubmissionId?: string) {
  const [assignment, setAssignment] = useState<GradingAssignment | null>(null);
  const [submissions, setSubmissions] = useState<GradingSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<GradingSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load assignment and submission list.
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [assignmentData, submissionsData] = await Promise.all([
          assignmentsApi.getById(assignmentId),
          submissionsApi.getByAssignment(assignmentId),
        ]);

        setAssignment(assignmentData as GradingAssignment);
        setSubmissions(submissionsData as GradingSubmission[]);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    if (assignmentId) {
      void loadData();
    }
  }, [assignmentId]);

  const selectSubmission = useCallback(async (submissionId: string) => {
    try {
      const detailed = await submissionsApi.getById(submissionId);
      setSelectedSubmission(detailed as GradingSubmission);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, []);

  // Keep selected submission in sync with URL query param without reloading all data.
  useEffect(() => {
    if (!initialSubmissionId) return;
    if (selectedSubmission?.id === initialSubmissionId) return;
    if (!submissions.some((submission) => submission.id === initialSubmissionId)) return;

    void selectSubmission(initialSubmissionId);
  }, [initialSubmissionId, selectSubmission, selectedSubmission?.id, submissions]);

  const submitGrade = async (grades: QuestionGrade[]) => {
    if (!selectedSubmission) return;

    try {
      setIsSubmitting(true);

      const payload = {
        grades: grades.map((grade) => ({
          answerId: grade.answerId,
          points: Math.round(grade.points),
          maxPoints: Math.round(grade.maxPoints),
          feedback: grade.feedback.trim() ? grade.feedback.trim() : undefined,
        })),
      };

      await submissionsApi.grade(selectedSubmission.id, payload);

      // Reload submission
      const updated = await submissionsApi.getById(selectedSubmission.id);
      setSelectedSubmission(updated as GradingSubmission);

      // Update submissions list
      setSubmissions((prev) =>
        prev.map((submission) =>
          submission.id === selectedSubmission.id ? { ...submission, status: 'graded' as const } : submission
        )
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    assignment,
    submissions,
    selectedSubmission,
    loading,
    error,
    selectSubmission,
    submitGrade,
    isSubmitting,
  };
}
