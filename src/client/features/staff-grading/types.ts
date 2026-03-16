export type GradingAssignment = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  timeLimit: number | null;
  maxAttempts: number;
};

export type GradingSubmission = {
  id: string;
  assignmentId: string;
  userId: string;
  attemptNumber: number;
  status: 'draft' | 'submitted' | 'late' | 'grading' | 'graded';
  startedAt: string;
  submittedAt: string | null;
  gradedAt: string | null;
  user?: {
    id: string;
    email: string;
    fullName: string | null;
  };
  answers?: GradingAnswer[];
  marks?: GradingMark[];
};

export type GradingAnswer = {
  id: string;
  submissionId: string;
  questionId: string;
  content: Record<string, unknown>;
  fileUrl: string | null;
  createdAt: string;
  updatedAt: string;
  aiGradingSuggestion?: Record<string, unknown> | string | null;
  question?: {
    id: string;
    title: string;
    type: 'mcq' | 'written' | 'coding' | 'uml';
    content: Record<string, unknown>;
    points: number;
  };
};

export type GradingMark = {
  id: string;
  submissionId: string;
  answerId: string | null;
  points: number;
  maxPoints: number;
  feedback: string | null;
  isAiAssisted: boolean;
  markedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QuestionGrade = {
  answerId: string;
  questionId: string;
  points: number;
  maxPoints: number;
  feedback: string;
};
