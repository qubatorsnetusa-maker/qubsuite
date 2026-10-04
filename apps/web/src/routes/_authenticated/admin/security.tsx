import { createFileRoute } from '@tanstack/react-router';
import { AdminSecurityPage } from '@/features/admin/security-page';

export const Route = createFileRoute('/_authenticated/admin/security')({
  component: AdminSecurityPage,
});
