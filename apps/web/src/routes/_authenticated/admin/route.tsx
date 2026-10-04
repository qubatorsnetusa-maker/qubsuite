import { createFileRoute } from '@tanstack/react-router';
import { AdminLayout } from '@/features/admin/admin-layout';

/** Super admin console. Non-admins see a 403 page; the API enforces the same rule on every request. */
export const Route = createFileRoute('/_authenticated/admin')({
  component: AdminLayout,
});
