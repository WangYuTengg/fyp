import { createFileRoute } from '@tanstack/react-router';
import { StudentDashboard } from '../../features/student-dashboard/StudentDashboard';

export const Route = createFileRoute('/student/')({
  component: StudentDashboard,
});
