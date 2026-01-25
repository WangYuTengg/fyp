import { createFileRoute } from '@tanstack/react-router';
import { StudentAssignmentAttempt } from '../../../features/student-assignment/StudentAssignmentAttempt';

export const Route = createFileRoute('/student/assignments/$assignmentId')({
  component: StudentAssignmentRoute,
});

function StudentAssignmentRoute() {
  const { assignmentId } = Route.useParams();
  return <StudentAssignmentAttempt assignmentId={assignmentId} />;
}
