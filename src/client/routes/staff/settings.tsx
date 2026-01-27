import { createFileRoute } from '@tanstack/react-router';
import StaffSettings from '../../features/staff-settings/StaffSettings';

export const Route = createFileRoute('/staff/settings')({
  component: StaffSettings,
});
