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

  const cloneMutation = useMutation({
    mutationFn: (data: { assignmentId: string; targetCourseId?: string; newTitle?: string; newDueDate?: string | null }) =>
      assignmentsApi.clone(data.assignmentId, {
        targetCourseId: data.targetCourseId,
        newTitle: data.newTitle,
        newDueDate: data.newDueDate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments', courseId] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to clone assignment: ' + message);
    },
  });

  const createAssignment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const maxAttemptsRaw = Number(formData.get('maxAttempts'));
    const mcqPenaltyRaw = Number(formData.get('mcqPenaltyPerWrongSelection'));
    const timeLimitRaw = Number(formData.get('timeLimit'));
    const mcqPenaltyPerWrongSelection = Number.isFinite(mcqPenaltyRaw)
      ? Math.max(0, Math.floor(mcqPenaltyRaw))
      : 1;
    const maxAttempts = Number.isFinite(maxAttemptsRaw)
      ? Math.max(1, Math.floor(maxAttemptsRaw))
      : 1;
    const timeLimit = String(formData.get('timeLimit') || '').trim().length > 0 && Number.isFinite(timeLimitRaw)
      ? Math.max(1, Math.floor(timeLimitRaw))
      : null;

    const latePenaltyType = String(formData.get('latePenaltyType') || 'none');
    const latePenaltyValueRaw = Number(formData.get('latePenaltyValue'));
    const latePenaltyCapRaw = Number(formData.get('latePenaltyCap'));
    const attemptScoringMethod = String(formData.get('attemptScoringMethod') || 'latest');

    createMutation.mutate({
      courseId,
      title: String(formData.get('title') || '').trim(),
      description: String(formData.get('description') || '').trim() || null,
      dueDate: formData.get('dueDate') || null,
      openDate: formData.get('openDate') || null,
      maxAttempts,
      mcqPenaltyPerWrongSelection,
      timeLimit,
      shuffleQuestions: formData.get('shuffleQuestions') === '1',
      latePenaltyType,
      latePenaltyValue: latePenaltyType !== 'none' && Number.isFinite(latePenaltyValueRaw) ? latePenaltyValueRaw : undefined,
      latePenaltyCap: latePenaltyType !== 'none' && String(formData.get('latePenaltyCap') || '').trim().length > 0 && Number.isFinite(latePenaltyCapRaw) ? latePenaltyCapRaw : undefined,
      attemptScoringMethod,
      questionIds: selectedQuestionIds,
    });
  };

  const togglePublish = (assignmentId: string, nextIsPublished: boolean) => {
    publishMutation.mutate({ assignmentId, nextIsPublished });
  };

  const cloneAssignment = (assignmentId: string, options?: { newTitle?: string; newDueDate?: string | null }) => {
    cloneMutation.mutate({
      assignmentId,
      targetCourseId: courseId,
      newTitle: options?.newTitle,
      newDueDate: options?.newDueDate,
    });
  };

  return {
    showForm,
    setShowForm,
    selectedQuestionIds,
    setSelectedQuestionIds,
    createAssignment,
    togglePublish,
    deleteAssignment: (assignmentId: string) => deleteMutation.mutate(assignmentId),
    cloneAssignment,
    isCreating: createMutation.isPending,
    isCloning: cloneMutation.isPending,
  };
}
