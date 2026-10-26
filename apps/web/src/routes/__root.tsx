import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { ErrorState, FullPageSpinner } from '@/components/states';
import { CommandPalette } from '@/components/command-palette';

export interface RouterContext {
  queryClient: QueryClient;
}

function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Outlet />
      <CommandPalette />
    </>
  ),
  pendingComponent: () => <FullPageSpinner />,
  errorComponent: ({ error, reset }) => {
    const chunkError = isChunkLoadError(error);
    const handleRetry = () => {
      if (chunkError) {
        window.location.reload();
      } else {
        reset();
      }
    };
    return (
      <ErrorState
        error={
          chunkError
            ? 'A newer version of QubSuite is available. Refreshing will load the latest version.'
            : error
        }
        title={chunkError ? 'Update available' : 'Something went wrong'}
        onRetry={handleRetry}
        retryLabel={chunkError ? 'Refresh page' : 'Try again'}
      />
    );
  },
  notFoundComponent: () => (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-5xl font-light text-muted">404</h1>
      <p className="text-muted">That page doesn’t exist.</p>
      <a href="/drive" className="text-primary hover:underline">Go to Drive</a>
    </div>
  ),
});
