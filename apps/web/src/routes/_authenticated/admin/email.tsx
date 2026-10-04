import { createFileRoute } from '@tanstack/react-router';
import { AdminEmailPage } from '@/features/admin/email-page';

export const Route = createFileRoute('/_authenticated/admin/email')({
  component: AdminEmailPage,
});
