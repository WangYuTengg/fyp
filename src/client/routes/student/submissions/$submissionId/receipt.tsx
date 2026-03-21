import { createFileRoute } from '@tanstack/react-router';
import { SubmissionReceipt } from '../../../../features/student-assignment/components/SubmissionReceipt';

export const Route = createFileRoute('/student/submissions/$submissionId/receipt')({
  component: SubmissionReceiptRoute,
});

function SubmissionReceiptRoute() {
  const { submissionId } = Route.useParams();
  return <SubmissionReceipt submissionId={submissionId} />;
}
