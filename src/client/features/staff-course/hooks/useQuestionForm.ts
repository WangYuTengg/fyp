import { useState } from 'react';
import { questionsApi, type McqOption } from '../../../lib/api';

export function useQuestionForm(courseId: string, onSuccess: () => void) {
  const [showForm, setShowForm] = useState(false);
  const [questionType, setQuestionType] = useState<'mcq' | 'written'>('written');
  const [mcqOptions, setMcqOptions] = useState<McqOption[]>([
    { id: crypto.randomUUID(), text: '' },
    { id: crypto.randomUUID(), text: '' },
  ]);

  const createQuestion = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const title = String(formData.get('qTitle') || '').trim();
    const prompt = String(formData.get('qPrompt') || '').trim();
    const points = Number(formData.get('qPoints') || 10);

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

      try {
        await questionsApi.create({
          courseId,
          title,
          type: 'mcq',
          prompt,
          points,
          options,
          allowMultiple: false,
        });
        setShowForm(false);
        setQuestionType('written');
        setMcqOptions([
          { id: crypto.randomUUID(), text: '' },
          { id: crypto.randomUUID(), text: '' },
        ]);
        (e.currentTarget as HTMLFormElement).reset();
        onSuccess();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        alert('Failed to create question: ' + message);
      }
      return;
    }

    try {
      await questionsApi.create({ courseId, title, type: 'written', prompt, points });
      setShowForm(false);
      setQuestionType('written');
      (e.currentTarget as HTMLFormElement).reset();
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert('Failed to create question: ' + message);
    }
  };

  return {
    showForm,
    setShowForm,
    questionType,
    setQuestionType,
    mcqOptions,
    setMcqOptions,
    createQuestion,
  };
}
