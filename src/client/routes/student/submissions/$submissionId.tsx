import { createFileRoute } from '@tanstack/react-router';
import { StudentSubmissionView } from '../../../features/student-submission/StudentSubmissionView';

export const Route = createFileRoute('/student/submissions/$submissionId')({
  component: StudentSubmissionRoute,
});

function StudentSubmissionRoute() {
  const { submissionId } = Route.useParams();
  return <StudentSubmissionView submissionId={submissionId} />;
}
