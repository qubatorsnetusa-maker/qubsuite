import { createFileRoute } from '@tanstack/react-router';
import { guestOnly, redirectSearch } from '@/app/route-guards';
import { RegisterPage } from '@/features/auth/auth-pages';

export const Route = createFileRoute('/register')({
  validateSearch: redirectSearch,
  beforeLoad: guestOnly,
  component: RegisterPage,
});
