import { createFileRoute } from '@tanstack/react-router';
import { AutoGradingDashboard } from '../../features/staff-grading/AutoGradingDashboard';

export const Route = createFileRoute('/staff/auto-grading')({
  component: AutoGradingPage,
});

function AutoGradingPage() {
  return <AutoGradingDashboard />;
}
