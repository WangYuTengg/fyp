export type StaffCourse = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  academicYear: string;
  semester: string;
};

export type StaffEnrollmentRow = {
  id: string;
  role: string;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
};

export type StaffAssignment = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  maxAttempts: number | null;
  mcqPenaltyPerWrongSelection: number;
  isPublished: boolean;
  attemptCount: number;
};
