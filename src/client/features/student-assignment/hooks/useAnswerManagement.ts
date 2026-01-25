import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError, submissionsApi } from '../../../lib/api';
import type { AnswerState, AssignmentQuestion, Submission } from '../types';

export function useAnswerManagement(
  submission: Submission | null,
  questionsById: Map<string, AssignmentQuestion['question']>,
  isPastDue: boolean
) {
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const dirtyRef = useRef<Set<string>>(new Set());
  const answersRef = useRef<Record<string, AnswerState>>({});

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const isBlockingError = useCallback((err: unknown) => {
    if (err instanceof ApiRequestError) {
      return err.status === 401 || err.status === 403 || err.status === 409 || err.status >= 500;
    }
    return err instanceof TypeError;
  }, []);

  const saveAnswer = useCallback(
    async (questionId: string, silent = false) => {
      if (!submission || submitted) return;
      const question = questionsById.get(questionId);
      if (!question) return;

      if (isPastDue) {
        showToast('Assignment is past due. You can only submit your last saved answers.');
        return;
      }

      const draft = answersRef.current[questionId];
      const content =
        question.type === 'mcq'
          ? { selectedOptionIds: draft?.type === 'mcq' ? draft.selectedOptionIds : [] }
          : { text: draft?.type === 'written' ? draft.text : '' };

      try {
        if (!silent) {
          setSaving((prev) => ({ ...prev, [questionId]: true }));
        }
        await submissionsApi.saveAnswer(submission.id, {
          questionId,
          content,
        });
        dirtyRef.current.delete(questionId);
      } catch (err: unknown) {
        if (isBlockingError(err)) {
          const message = err instanceof Error ? err.message : String(err);
          showToast(message);
        }
      } finally {
        if (!silent) {
          setSaving((prev) => ({ ...prev, [questionId]: false }));
        }
      }
    },
    [isBlockingError, isPastDue, questionsById, showToast, submission, submitted]
  );

  useEffect(() => {
    if (!submission || submitted) return;

    const interval = setInterval(() => {
      if (isPastDue) return;
      const dirtyIds = Array.from(dirtyRef.current);
      if (dirtyIds.length === 0) return;
      dirtyIds.forEach((questionId) => {
        void saveAnswer(questionId, true);
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [isPastDue, saveAnswer, submission, submitted]);

  const submit = async () => {
    if (!submission) return;

    try {
      await submissionsApi.submit(submission.id);
      setSubmitted(true);
    } catch (err: unknown) {
      if (isBlockingError(err)) {
        const message = err instanceof Error ? err.message : String(err);
        showToast(message);
      }
    }
  };

  const updateAnswer = useCallback((questionId: string, answer: AnswerState) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    dirtyRef.current.add(questionId);
  }, []);

  return {
    answers,
    saving,
    submitted,
    toast,
    saveAnswer,
    submit,
    updateAnswer,
  };
}
