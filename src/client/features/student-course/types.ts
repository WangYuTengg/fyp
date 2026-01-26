export type StudentCourse = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  academicYear: string;
  semester: string;
};

export type StudentAssignment = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  dueDate: string | null;
  maxAttempts: number | null;
  submissionStatus?: 'draft' | 'submitted' | null;
};
