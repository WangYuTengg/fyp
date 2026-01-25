export type AssignmentQuestion = {
  id: string;
  order: number;
  points: number | null;
  question: {
    id: string;
    title: string;
    content: unknown;
    points: number;
    type: 'mcq' | 'written' | 'coding' | 'uml';
  };
};

export type AssignmentDetails = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  courseId: string;
  dueDate: string | null;
  questions: AssignmentQuestion[];
};

export type Submission = {
  id: string;
  assignmentId: string;
  userId: string;
  status: 'draft' | 'submitted' | 'grading' | 'graded';
};

export type AnswerState =
  | { type: 'written'; text: string }
  | { type: 'mcq'; selectedOptionIds: string[] };
