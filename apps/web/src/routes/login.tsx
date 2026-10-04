import { createFileRoute } from '@tanstack/react-router';
import { guestOnly, redirectSearch } from '@/app/route-guards';
import { LoginPage } from '@/features/auth/auth-pages';

export const Route = createFileRoute('/login')({
  validateSearch: redirectSearch,
  beforeLoad: guestOnly,
  component: LoginPage,
});
