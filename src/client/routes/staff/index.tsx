import { createFileRoute } from '@tanstack/react-router';
import { StaffDashboard } from '../../features/staff-dashboard/StaffDashboard';

export const Route = createFileRoute('/staff/')({
  component: StaffDashboard,
});
