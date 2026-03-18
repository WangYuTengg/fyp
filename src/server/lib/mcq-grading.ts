/**
 * MCQ auto-grading logic.
 *
 * Pure function — no DB or side-effect dependencies — so it is
 * straightforward to unit-test.
 */

type McqOption = {
  id?: string;
  isCorrect?: boolean;
};

export type McqGradeResult = {
  points: number;
  feedback: string;
};

/**
 * Auto-grade an MCQ answer.
 *
 * Supports single-select (all-or-nothing) and multi-select (partial credit
 * with per-wrong-selection penalty).
 *
 * @param questionContent - The question's content object (must have `options` array)
 * @param answerContent   - The student's answer (must have `selectedOptionIds` array)
 * @param maxPoints       - Maximum points for the question
 * @param penaltyPerWrongSelection - Points deducted per wrong selection (multi-select only)
 */
export function gradeMcqAnswer(
  questionContent: unknown,
  answerContent: unknown,
  maxPoints: number,
  penaltyPerWrongSelection: number,
): McqGradeResult {
  const content = (questionContent ?? {}) as Record<string, unknown>;
  const options = Array.isArray(content.options) ? (content.options as McqOption[]) : [];
  const allowMultiple = content.allowMultiple === true;

  const correctOptionIds = new Set(
    options
      .filter((option) => option.isCorrect === true && typeof option.id === 'string')
      .map((option) => option.id as string),
  );

  const rawSelectedOptionIds =
    typeof answerContent === 'object' &&
    answerContent !== null &&
    Array.isArray((answerContent as Record<string, unknown>).selectedOptionIds)
      ? ((answerContent as Record<string, unknown>).selectedOptionIds as unknown[])
      : [];
  const selectedOptionIds = [
    ...new Set(rawSelectedOptionIds.filter((id): id is string => typeof id === 'string')),
  ];

  if (correctOptionIds.size === 0) {
    return { points: 0, feedback: 'Question has no configured correct options.' };
  }

  if (!allowMultiple) {
    const isCorrect = selectedOptionIds.length === 1 && correctOptionIds.has(selectedOptionIds[0]);
    return isCorrect
      ? { points: maxPoints, feedback: 'Correct answer.' }
      : { points: 0, feedback: 'Incorrect answer.' };
  }

  const selectedSet = new Set(selectedOptionIds);
  const wrongSelections = selectedOptionIds.filter((id) => !correctOptionIds.has(id));
  const hasAllCorrect = Array.from(correctOptionIds).every((id) => selectedSet.has(id));
  const isExactMatch =
    hasAllCorrect && wrongSelections.length === 0 && selectedOptionIds.length === correctOptionIds.size;

  if (isExactMatch) {
    return { points: maxPoints, feedback: 'Correct answer.' };
  }

  if (wrongSelections.length > 0) {
    const penaltyUnit =
      Number.isFinite(penaltyPerWrongSelection) && penaltyPerWrongSelection >= 0
        ? penaltyPerWrongSelection
        : 1;
    const penaltyPoints = wrongSelections.length * penaltyUnit;

    if (penaltyPoints <= 0) {
      return { points: 0, feedback: 'Incorrect answer.' };
    }

    return {
      points: -penaltyPoints,
      feedback: `Incorrect answer. ${penaltyPoints} penalty point${penaltyPoints === 1 ? '' : 's'} for wrong selection${wrongSelections.length === 1 ? '' : 's'}.`,
    };
  }

  return { points: 0, feedback: 'Incorrect answer.' };
}
