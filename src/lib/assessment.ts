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
};

export type WrittenContent = {
  prompt: string;
  modelAnswer?: string;
};

export type UmlSubtype = 'class' | 'sequence';

export type UMLContent = {
  prompt: string;
  /** Defaults to 'class' when unset (legacy questions are class diagrams). */
  umlSubtype?: UmlSubtype;
  referenceDiagram?: string;
  modelAnswer?: string;
  /** Optional structured editor state mirroring `modelAnswer`. Used for grading diffs. */
  modelAnswerEditorState?: unknown;
  /** Optional structured editor state mirroring `referenceDiagram`. Falls back to `modelAnswerEditorState` if absent. */
  referenceDiagramEditorState?: unknown;
};

export type QuestionContent = McqContent | WrittenContent | UMLContent | Record<string, unknown>;

export type StudentAnswerContent = Record<string, unknown> & {
  text?: string;
  umlText?: string;
};

/**
 * Loose union — same payload field set covers class and sequence diffs.
 * Legacy snapshots written before sequence support omit `type` and have only
 * `classes` / `edges` populated; treat absent `type` as 'class'.
 */
export type StructuralDiffSnapshot = {
  type?: 'class' | 'sequence';
  score: number;
  summary: string;
  // class-diagram fields
  classes?: unknown;
  edges?: unknown;
  // sequence-diagram fields
  lifelines?: unknown;
  messages?: unknown;
  orderScore?: number;
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
  structuralDiff?: StructuralDiffSnapshot | null;
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
