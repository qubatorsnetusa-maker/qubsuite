import { createFileRoute } from '@tanstack/react-router';
import { AdminOrgSettingsPage } from '@/features/admin/org-settings-page';

export const Route = createFileRoute('/_authenticated/admin/settings')({
  component: AdminOrgSettingsPage,
});
