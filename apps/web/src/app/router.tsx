import { createRouter } from '@tanstack/react-router';
import { routeTree } from '@/routeTree.gen';
import { queryClient } from './query-client';

/** Routes are file-based (src/routes); the Vite plugin generates src/routeTree.gen.ts. */
export const router = createRouter({
  basepath: '/qubsuite',
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
