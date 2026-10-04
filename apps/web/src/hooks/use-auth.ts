import { useSyncExternalStore } from 'react';
import { authStore, type AuthState } from '@/lib/auth-store';

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (cb) => authStore.subscribe(cb),
    () => authStore.get(),
  );
}

/** The signed-in user; only call inside authenticated routes. */
export function useCurrentUser() {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser used outside an authenticated route');
  return user;
}

/** Resolves the session once on app start (via the refresh cookie). */
export async function ensureSession(): Promise<AuthState> {
  if (authStore.get().status === 'unknown') await authStore.refresh();
  return authStore.get();
}
