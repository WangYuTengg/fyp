import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentsApi } from '../../../lib/api';

export function useAssignmentForm(courseId: string) {
  const [showForm, setShowForm] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => assignmentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments', courseId] });
      setShowForm(false);
      setSelectedQuestionIds([]);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to create assignment: ' + message);
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ assignmentId, nextIsPublished }: { assignmentId: string; nextIsPublished: boolean }) =>
      assignmentsApi.publish(assignmentId, nextIsPublished),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments', courseId] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to update assignment: ' + message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (assignmentId: string) => assignmentsApi.remove(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments', courseId] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to delete assignment: ' + message);
    },
  });

  const createAssignment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const mcqPenaltyRaw = Number(formData.get('mcqPenaltyPerWrongSelection'));
    const mcqPenaltyPerWrongSelection = Number.isFinite(mcqPenaltyRaw)
      ? Math.max(0, Math.floor(mcqPenaltyRaw))
      : 1;

    createMutation.mutate({
      courseId,
      title: formData.get('title'),
      description: formData.get('description'),
      dueDate: formData.get('dueDate') || null,
      maxAttempts: Number(formData.get('maxAttempts')) || 1,
      mcqPenaltyPerWrongSelection,
      questionIds: selectedQuestionIds,
    });
  };

  const togglePublish = (assignmentId: string, nextIsPublished: boolean) => {
    publishMutation.mutate({ assignmentId, nextIsPublished });
  };

  return {
    showForm,
    setShowForm,
    selectedQuestionIds,
    setSelectedQuestionIds,
    createAssignment,
    togglePublish,
    deleteAssignment: (assignmentId: string) => deleteMutation.mutate(assignmentId),
    isCreating: createMutation.isPending,
  };
}
