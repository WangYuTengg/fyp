import { useState, useEffect } from 'react';
import { assignmentsApi, submissionsApi } from '../../../lib/api';
import type { GradingAssignment, GradingSubmission, QuestionGrade } from '../types';

export function useGrading(assignmentId: string, initialSubmissionId?: string) {
  const [assignment, setAssignment] = useState<GradingAssignment | null>(null);
  const [submissions, setSubmissions] = useState<GradingSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<GradingSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load assignment and submissions
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
        const typedSubmissions = submissionsData as GradingSubmission[];
        setSubmissions(typedSubmissions);

        // Auto-select submission if provided in URL
        if (initialSubmissionId) {
          const selected = typedSubmissions.find((s) => s.id === initialSubmissionId);
          if (selected) {
            const detailed = await submissionsApi.getById(selected.id);
            setSelectedSubmission(detailed as GradingSubmission);
          }
        }
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
  }, [assignmentId, initialSubmissionId]);

  const selectSubmission = async (submissionId: string) => {
    try {
      const detailed = await submissionsApi.getById(submissionId);
      setSelectedSubmission(detailed as GradingSubmission);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  const submitGrade = async (grades: QuestionGrade[]) => {
    if (!selectedSubmission) return;

    try {
      setIsSubmitting(true);
      await submissionsApi.grade(selectedSubmission.id, { grades });

      // Reload submission
      const updated = await submissionsApi.getById(selectedSubmission.id);
      setSelectedSubmission(updated as GradingSubmission);

      // Update submissions list
      setSubmissions((prev) =>
        prev.map((s) => (s.id === selectedSubmission.id ? { ...s, status: 'graded' as const } : s))
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
