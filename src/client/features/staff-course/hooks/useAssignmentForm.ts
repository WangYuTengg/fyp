import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assignmentsApi } from '../../../lib/api';

export function useAssignmentForm(courseId: string) {
  const [showForm, setShowForm] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [assignmentType, setAssignmentType] = useState<'mcq' | 'written'>('mcq');
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
    mutationFn: ({ assignmentId, isPublished }: { assignmentId: string; isPublished: boolean }) =>
      assignmentsApi.publish(assignmentId, !isPublished),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments', courseId] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to update assignment: ' + message);
    },
  });

  const handleAssignmentTypeChange = (newType: 'mcq' | 'written') => {
    setAssignmentType(newType);
    setSelectedQuestionIds([]);
  };

  const createAssignment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    createMutation.mutate({
      courseId,
      title: formData.get('title'),
      description: formData.get('description'),
      type: assignmentType,
      dueDate: formData.get('dueDate') || null,
      maxAttempts: Number(formData.get('maxAttempts')) || 1,
      questionIds: selectedQuestionIds,
    });
  };

  const togglePublish = (assignmentId: string, isPublished: boolean) => {
    publishMutation.mutate({ assignmentId, isPublished });
  };

  return {
    showForm,
    setShowForm,
    selectedQuestionIds,
    setSelectedQuestionIds,
    assignmentType,
    setAssignmentType: handleAssignmentTypeChange,
    createAssignment,
    togglePublish,
    isCreating: createMutation.isPending,
  };
}
