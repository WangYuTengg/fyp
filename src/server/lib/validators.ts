import { db } from '../../db/index.js';
import { questions, assignmentQuestions } from '../../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

/**
 * Validation utilities for auto-grading
 */

export type MissingAnswer = {
  questionId: string;
  title: string;
  type: 'mcq' | 'written' | 'coding' | 'uml';
};

export type ValidationResult = {
  valid: boolean;
  missingAnswers: MissingAnswer[];
};

/**
 * Validate that all questions in an assignment have model answers
 * - Written questions need modelAnswer in content
 * - UML questions need modelAnswer (or legacy referenceDiagram) in content
 * - MCQ questions need correct answers marked (isCorrect flags)
 * 
 * @param assignmentId - Assignment to validate
 * @returns Validation result with list of questions missing answers
 */
export async function validateAssignmentHasAnswers(
  assignmentId: string
): Promise<ValidationResult> {
  // Get all questions in the assignment
  const assignmentQs = await db
    .select({
      questionId: assignmentQuestions.questionId,
    })
    .from(assignmentQuestions)
    .where(eq(assignmentQuestions.assignmentId, assignmentId));

  if (assignmentQs.length === 0) {
    return { valid: true, missingAnswers: [] };
  }

  const questionIds = assignmentQs.map((q) => q.questionId);

  // Fetch question details
  const questionsData = await db
    .select({
      id: questions.id,
      title: questions.title,
      type: questions.type,
      content: questions.content,
    })
    .from(questions)
    .where(inArray(questions.id, questionIds));

  const missingAnswers: MissingAnswer[] = [];

  for (const question of questionsData) {
    const content = question.content as Record<string, unknown>;

    if (question.type === 'written') {
      // Check for modelAnswer
      const hasModelAnswer = content.modelAnswer && typeof content.modelAnswer === 'string' && content.modelAnswer.trim().length > 0;
      if (!hasModelAnswer) {
        missingAnswers.push({
          questionId: question.id,
          title: question.title,
          type: question.type,
        });
      }
    } else if (question.type === 'uml') {
      const hasUmlAnswer =
        (content.modelAnswer && typeof content.modelAnswer === 'string' && content.modelAnswer.trim().length > 0) ||
        (content.referenceDiagram && typeof content.referenceDiagram === 'string' && content.referenceDiagram.trim().length > 0);
      if (!hasUmlAnswer) {
        missingAnswers.push({
          questionId: question.id,
          title: question.title,
          type: question.type,
        });
      }
    } else if (question.type === 'mcq') {
      // Check for correct answers (options with isCorrect: true)
      const options = content.options as Array<{ isCorrect?: boolean }> | undefined;
      const hasCorrectAnswer = options && options.some((opt) => opt.isCorrect === true);
      if (!hasCorrectAnswer) {
        missingAnswers.push({
          questionId: question.id,
          title: question.title,
          type: question.type,
        });
      }
    }
  }

  return {
    valid: missingAnswers.length === 0,
    missingAnswers,
  };
}

/**
 * Validate a single question has a model answer
 * @param questionId - Question to validate
 * @returns True if question has model answer
 */
export async function validateQuestionHasAnswer(
  questionId: string
): Promise<boolean> {
  const [question] = await db
    .select({
      type: questions.type,
      content: questions.content,
    })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!question) {
    return false;
  }

  const content = question.content as Record<string, unknown>;

  if (question.type === 'written') {
    return !!(content.modelAnswer && typeof content.modelAnswer === 'string' && content.modelAnswer.trim().length > 0);
  } else if (question.type === 'uml') {
    return !!(
      (content.modelAnswer && typeof content.modelAnswer === 'string' && content.modelAnswer.trim().length > 0) ||
      (content.referenceDiagram && typeof content.referenceDiagram === 'string' && content.referenceDiagram.trim().length > 0)
    );
  } else if (question.type === 'mcq') {
    const options = content.options as Array<{ isCorrect?: boolean }> | undefined;
    return !!(options && options.some((opt) => opt.isCorrect === true));
  }

  return false;
}
