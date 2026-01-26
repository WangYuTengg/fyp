import { createFileRoute } from '@tanstack/react-router';
import { StaffGrading } from '../../features/staff-grading/StaffGrading';

export const Route = createFileRoute('/staff/grading')({
  component: GradingPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      assignmentId: search.assignmentId as string,
      submissionId: search.submissionId as string | undefined,
    };
  },
});

function GradingPage() {
  return <StaffGrading />;
}
