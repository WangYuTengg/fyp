export type RubricCriterion = {
  id: string;
  description: string;
  maxPoints: number;
};

export type GradingCriterionScore = {
  criterion: string;
  score: number;
  comment: string;
};

export type McqOption = {
  id: string;
  text: string;
  isCorrect?: boolean;
};

export type McqContent = {
  prompt: string;
  options: McqOption[];
  allowMultiple?: boolean;
  showCorrectAnswers?: boolean;
};

export type WrittenContent = {
  prompt: string;
  modelAnswer?: string;
};

export type UMLContent = {
  prompt: string;
  referenceDiagram?: string;
  modelAnswer?: string;
};

export type QuestionContent = McqContent | WrittenContent | UMLContent | Record<string, unknown>;

export type StudentAnswerContent = Record<string, unknown> & {
  text?: string;
  umlText?: string;
};

export type AiGradingSuggestion = {
  points: number;
  reasoning: string;
  confidence: number;
  model: string;
  tokensUsed: number;
  cost: number;
  promptVersion: string;
  gradedAt: string;
  extractedUml?: string | null;
  criteriaScores?: GradingCriterionScore[] | null;
};

export type NotificationType = 'grading_failed' | 'grading_completed' | 'batch_completed' | 'auto_submitted';

export type GradingFailedNotificationData = {
  answerId?: string;
  questionId?: string;
  submissionId?: string;
  error?: string;
  batchId?: string | null;
};

export type GradingCompletedNotificationData = {
  answerId?: string;
  submissionId?: string;
  points?: number;
  maxPoints?: number;
  confidence?: number;
};

export type BatchCompletedNotificationData = {
  batchId?: string;
  total?: number;
  completed?: number;
  failed?: number;
  count?: number;
};

export type StaffNotificationData =
  | GradingFailedNotificationData
  | GradingCompletedNotificationData
  | BatchCompletedNotificationData
  | Record<string, unknown>;
