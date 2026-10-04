import { createFileRoute } from '@tanstack/react-router';
import { tokenSearch } from '@/app/route-guards';
import { ResetPasswordPage } from '@/features/auth/auth-pages';

export const Route = createFileRoute('/reset-password')({
  validateSearch: tokenSearch,
  component: ResetPasswordPage,
});
