import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { ErrorState, FullPageSpinner } from '@/components/states';

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
  pendingComponent: () => <FullPageSpinner />,
  errorComponent: ({ error, reset }) => <ErrorState error={error} onRetry={reset} />,
  notFoundComponent: () => (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-5xl font-light text-muted">404</h1>
      <p className="text-muted">That page doesn’t exist.</p>
      <a href="/drive" className="text-primary hover:underline">Go to Drive</a>
    </div>
  ),
});
