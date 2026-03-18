import { createFileRoute } from '@tanstack/react-router';
import { BulkReviewWorkflow } from '../../features/staff-grading/components/BulkReviewWorkflow';

export const Route = createFileRoute('/staff/grading/review')({
  component: ReviewPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      assignmentId: search.assignmentId as string,
    };
  },
});

function ReviewPage() {
  return <BulkReviewWorkflow />;
}
