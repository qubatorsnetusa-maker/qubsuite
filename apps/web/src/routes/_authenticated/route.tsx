import { createFileRoute, Navigate, Outlet, redirect } from '@tanstack/react-router';
import { ensureSession, useAuth } from '@/hooks/use-auth';

/** Pathless layout: everything below requires a signed-in user. */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const s = await ensureSession();
    if (s.status !== 'authenticated') throw redirect({ to: '/login', search: { redirect: location.href } });
  },
  component: AuthenticatedLayout,
});

/** Signing out (here or in another tab) ends the session while these pages are mounted; leave before they render without a user. */
function AuthenticatedLayout() {
  const { user } = useAuth();
  // A fixed target: deriving it from the (changing) location would re-trigger the navigation while it's in flight.
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
