import { createFileRoute } from '@tanstack/react-router';
import AdminUsers from '../../../features/admin-users/AdminUsers';

export const Route = createFileRoute('/staff/admin/users')({
  component: AdminUsers,
});
