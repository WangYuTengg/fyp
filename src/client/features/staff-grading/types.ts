export type GradingAssignment = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  type: 'mcq' | 'written' | 'coding' | 'uml';
  dueDate: string | null;
  timeLimit: number | null;
  maxAttempts: number;
};

export type GradingSubmission = {
  id: string;
  assignmentId: string;
  userId: string;
  attemptNumber: number;
  status: 'draft' | 'submitted' | 'grading' | 'graded';
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
  questionId: string;
  points: number;
  maxPoints: number;
  feedback: string | null;
  isAiAssisted: boolean;
  gradedBy: string;
  createdAt: string;
};

export type QuestionGrade = {
  questionId: string;
  points: number;
  feedback: string;
};
