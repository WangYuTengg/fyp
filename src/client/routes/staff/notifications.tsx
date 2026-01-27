import { createFileRoute } from '@tanstack/react-router';
import { StaffNotifications } from '../../features/staff-notifications/StaffNotifications';

export const Route = createFileRoute('/staff/notifications')({
  component: NotificationsPage,
});

function NotificationsPage() {
  return <StaffNotifications />;
}
