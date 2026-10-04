import { createFileRoute } from '@tanstack/react-router';
import { AdminPoliciesPage } from '@/features/admin/policies-page';

export const Route = createFileRoute('/_authenticated/admin/policies')({
  component: AdminPoliciesPage,
});
