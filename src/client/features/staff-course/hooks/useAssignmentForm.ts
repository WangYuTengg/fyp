import { useState } from 'react';
import { assignmentsApi } from '../../../lib/api';

export function useAssignmentForm(courseId: string, onSuccess: () => void) {
  const [showForm, setShowForm] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [assignmentType, setAssignmentType] = useState<'mcq' | 'written'>('mcq');

  const handleAssignmentTypeChange = (newType: 'mcq' | 'written') => {
    setAssignmentType(newType);
    setSelectedQuestionIds([]);
  };

  const createAssignment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      await assignmentsApi.create({
        courseId,
        title: formData.get('title'),
        description: formData.get('description'),
        type: assignmentType,
        dueDate: formData.get('dueDate') || null,
        maxAttempts: Number(formData.get('maxAttempts')) || 1,
        questionIds: selectedQuestionIds,
      });

      setShowForm(false);
      setSelectedQuestionIds([]);
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to create assignment: ' + message);
    }
  };

  const togglePublish = async (assignmentId: string, isPublished: boolean) => {
    try {
      await assignmentsApi.publish(assignmentId, !isPublished);
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to update assignment: ' + message);
    }
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
  };
}
