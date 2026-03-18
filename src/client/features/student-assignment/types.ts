import type { ClassDiagramState } from '../../components/uml/classDiagram';
import type { QuestionTypeCounts } from '../../lib/question-types';

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
  courseId: string;
  dueDate: string | null;
  timeLimit: number | null;
  mcqPenaltyPerWrongSelection: number;
  monitorFocus: boolean;
  maxTabSwitches: number | null;
  questionCount: number;
  questionTypeCounts: QuestionTypeCounts;
  questions: AssignmentQuestion[];
};

export type Submission = {
  id: string;
  assignmentId: string;
  userId: string;
  status: 'draft' | 'submitted' | 'late' | 'grading' | 'graded';
  startedAt: string;
  answers?: Answer[];
};

export type Answer = {
  id: string;
  submissionId: string;
  questionId: string;
  content: {
    text?: string;
    selectedOptionIds?: string[];
    umlText?: string;
    editorState?: ClassDiagramState;
  };
  fileUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnswerState =
  | { type: 'written'; text: string }
  | { type: 'coding'; text: string }
  | { type: 'mcq'; selectedOptionIds: string[] }
  | { type: 'uml'; umlText: string; editorState?: ClassDiagramState };
