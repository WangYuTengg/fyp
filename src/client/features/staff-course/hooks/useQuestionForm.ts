import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { questionsApi, type McqOption } from '../../../lib/api';
import type { StaffAssignment } from '../types';

export function useQuestionForm(courseId: string, _assignments: StaffAssignment[]) {
  const [showForm, setShowForm] = useState(false);
  const [questionType, setQuestionType] = useState<'mcq' | 'written' | 'uml'>('written');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [mcqOptions, setMcqOptions] = useState<McqOption[]>([
    { id: crypto.randomUUID(), text: '' },
    { id: crypto.randomUUID(), text: '' },
  ]);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof questionsApi.create>[0]) => questionsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', courseId] });
      queryClient.invalidateQueries({ queryKey: ['assignments', courseId] });
      queryClient.invalidateQueries({ queryKey: ['tags', courseId] });
      setShowForm(false);
      setQuestionType('written');
      setSelectedAssignmentId('');
      setMcqOptions([
        { id: crypto.randomUUID(), text: '' },
        { id: crypto.randomUUID(), text: '' },
      ]);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to create question: ' + message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (questionId: string) => questionsApi.remove(questionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', courseId] });
      queryClient.invalidateQueries({ queryKey: ['assignments', courseId] });
      queryClient.invalidateQueries({ queryKey: ['tags', courseId] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to delete question: ' + message);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof questionsApi.update>[1] }) =>
      questionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions', courseId] });
      queryClient.invalidateQueries({ queryKey: ['assignments', courseId] });
      queryClient.invalidateQueries({ queryKey: ['tags', courseId] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to update question: ' + message);
    },
  });

  const createQuestion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const title = String(formData.get('qTitle') || '').trim();
    const prompt = String(formData.get('qPrompt') || '').trim();
    const points = Number(formData.get('qPoints') || 10);
    const tagsJson = String(formData.get('tags') || '[]');
    const tags = JSON.parse(tagsJson) as string[];
    const umlDiagram = String(formData.get('umlDiagram') || '');

    if (questionType === 'mcq') {
      const options = mcqOptions
        .map((option) => ({
          id: option.id || crypto.randomUUID(),
          text: option.text.trim(),
        }))
        .filter((option) => option.text.length > 0);

      if (options.length < 2) {
        alert('MCQ requires at least two options.');
        return;
      }

      createMutation.mutate({
        courseId,
        title,
        type: 'mcq',
        prompt,
        points,
        options,
        allowMultiple: false,
        assignmentId: selectedAssignmentId || undefined,
        tags: tags.length > 0 ? tags : undefined,
      } as Parameters<typeof questionsApi.create>[0]);
      return;
    }

    if (questionType === 'uml') {
      createMutation.mutate({
        courseId,
        title,
        type: 'uml',
        prompt,
        points,
        referenceDiagram: umlDiagram,
        assignmentId: selectedAssignmentId || undefined,
        tags: tags.length > 0 ? tags : undefined,
      } as Parameters<typeof questionsApi.create>[0]);
      return;
    }

    createMutation.mutate({
      courseId,
      title,
      type: 'written',
      prompt,
      points,
      assignmentId: selectedAssignmentId || undefined,
      tags: tags.length > 0 ? tags : undefined,
    } as Parameters<typeof questionsApi.create>[0]);
  };

  return {
    showForm,
    setShowForm,
    questionType,
    setQuestionType,
    mcqOptions,
    setMcqOptions,
    selectedAssignmentId,
    setSelectedAssignmentId,
    createQuestion,
    deleteQuestion: (questionId: string) => deleteMutation.mutate(questionId),
    editQuestion: (id: string, data: Parameters<typeof questionsApi.update>[1]) =>
      editMutation.mutate({ id, data }),
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isEditing: editMutation.isPending,
  };
}
