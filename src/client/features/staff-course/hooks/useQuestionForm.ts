import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { questionsApi, type McqOption } from '../../../lib/api';
import type { StaffAssignment } from '../types';

export function useQuestionForm(courseId: string, _assignments: StaffAssignment[]) {
  const [showForm, setShowForm] = useState(false);
  const [questionType, setQuestionType] = useState<'mcq' | 'written' | 'uml'>('written');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [mcqOptions, setMcqOptions] = useState<McqOption[]>([
    { id: crypto.randomUUID(), text: '', points: 0, isCorrect: false },
    { id: crypto.randomUUID(), text: '', points: 0, isCorrect: false },
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
        { id: crypto.randomUUID(), text: '', points: 0, isCorrect: false },
        { id: crypto.randomUUID(), text: '', points: 0, isCorrect: false },
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
    const umlTemplateDiagram = String(formData.get('umlTemplateDiagram') || '');
    const umlModelAnswer = String(formData.get('umlModelAnswer') || '');
    const showCorrectAnswers = formData.get('showCorrectAnswers') === 'on';
    const modelAnswer = String(formData.get('modelAnswer') || '').trim();

    if (questionType === 'mcq') {
      const mcqOptionsJson = String(formData.get('mcqOptions') || '[]');
      const options = JSON.parse(mcqOptionsJson) as McqOption[];

      const validOptions = options.filter((option) => option.text.trim().length > 0);

      if (validOptions.length < 2) {
        alert('MCQ requires at least two options.');
        return;
      }

      createMutation.mutate({
        courseId,
        title,
        type: 'mcq',
        prompt,
        points,
        options: validOptions,
        allowMultiple: false,
        showCorrectAnswers,
        assignmentId: selectedAssignmentId || undefined,
        tags: tags.length > 0 ? tags : undefined,
      } as Parameters<typeof questionsApi.create>[0]);
      return;
    }

    if (questionType === 'uml') {
      if (!umlModelAnswer.trim()) {
        alert('UML question requires an answer diagram (PlantUML code).');
        return;
      }
      createMutation.mutate({
        courseId,
        title,
        type: 'uml',
        prompt,
        points,
        modelAnswer: umlModelAnswer,
        referenceDiagram: umlTemplateDiagram || undefined,
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
      modelAnswer: modelAnswer || undefined,
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
