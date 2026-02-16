import { useState } from 'react';
import { coursesApi } from '../../../lib/api';

export function useCourseForm(onSuccess: () => void) {
  const [showForm, setShowForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const createCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      setIsCreating(true);
      await coursesApi.create({
        code: String(formData.get('code') || ''),
        name: String(formData.get('name') || ''),
        description: String(formData.get('description') || ''),
        academicYear: String(formData.get('academicYear') || ''),
        semester: String(formData.get('semester') || ''),
      });

      setShowForm(false);
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to create course: ' + message);
    } finally {
      setIsCreating(false);
    }
  };

  return {
    showForm,
    setShowForm,
    createCourse,
    isCreating,
  };
}
