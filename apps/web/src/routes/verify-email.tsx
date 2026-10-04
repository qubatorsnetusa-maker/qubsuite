import { createFileRoute } from '@tanstack/react-router';
import { tokenSearch } from '@/app/route-guards';
import { VerifyEmailPage } from '@/features/auth/auth-pages';

export const Route = createFileRoute('/verify-email')({
  validateSearch: tokenSearch,
  component: VerifyEmailPage,
});
