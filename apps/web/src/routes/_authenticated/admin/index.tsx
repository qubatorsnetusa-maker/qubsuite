import { createFileRoute } from '@tanstack/react-router';
import { AdminDashboardPage } from '@/features/admin/dashboard-page';

export const Route = createFileRoute('/_authenticated/admin/')({
  component: AdminDashboardPage,
});
