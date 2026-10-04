import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, errorMessage } from '@/lib/api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      // Retry transient failures only; auth/permission/validation errors won't fix themselves.
      retry: (count, error) => {
        if (error instanceof ApiError && error.status > 0 && error.status < 500 && error.status !== 429) return false;
        return count < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: { retry: false },
  },
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      // Mutations can opt out (meta.silent) when they render errors inline, e.g. forms.
      if (mutation.meta?.silent) return;
      toast.error(errorMessage(error));
    },
  }),
});

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { silent?: boolean };
  }
}
