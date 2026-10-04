import type { AuthResult, CurrentUser } from '@qub/shared';

export interface AuthState {
  status: 'unknown' | 'authenticated' | 'anonymous';
  accessToken: string | null;
  expiresAt: number;
  user: CurrentUser | null;
}

type Listener = (state: AuthState) => void;

/**
 * The access token lives only in memory (never localStorage), so XSS cannot exfiltrate a long-lived credential.
 * The refresh token is an httpOnly cookie the browser sends to /api/auth only.
 */
class AuthStore {
  private state: AuthState = { status: 'unknown', accessToken: null, expiresAt: 0, user: null };
  private readonly listeners = new Set<Listener>();
  private refreshing: Promise<boolean> | null = null;
  private readonly channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('qub-auth') : null;

  constructor() {
    // Keep tabs in sync: a logout in one tab signs every tab out.
    this.channel?.addEventListener('message', (e: MessageEvent<{ type: string }>) => {
      if (e.data?.type === 'logout') this.set({ status: 'anonymous', accessToken: null, expiresAt: 0, user: null });
    });
  }

  get(): AuthState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(next: AuthState) {
    this.state = next;
    for (const l of this.listeners) l(next);
  }

  setSession(result: AuthResult) {
    this.set({ status: 'authenticated', accessToken: result.accessToken, expiresAt: Date.parse(result.accessTokenExpiresAt), user: result.user });
  }

  setUser(user: CurrentUser) {
    if (this.state.status === 'authenticated') this.set({ ...this.state, user });
  }

  clear(broadcast = true) {
    this.set({ status: 'anonymous', accessToken: null, expiresAt: 0, user: null });
    if (broadcast) this.channel?.postMessage({ type: 'logout' });
  }

  /**
   * Single-flight refresh using the httpOnly cookie. Concurrent callers share one request.
   * A 409 means another tab is rotating the token right now; wait briefly and retry with the new cookie.
   */
  refresh(): Promise<boolean> {
    this.refreshing ??= (async () => {
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include', headers: { 'X-Requested-With': 'qub' } });
          if (res.ok) {
            this.setSession((await res.json()).data as AuthResult);
            return true;
          }
          if (res.status === 409) {
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
            continue;
          }
          break;
        }
        this.clear(false);
        return false;
      } catch {
        // Network failure: keep the current state so offline editing is not interrupted.
        if (this.state.status === 'unknown') this.set({ ...this.state, status: 'anonymous' });
        return false;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  /** A token that is valid for at least another 30 seconds, refreshing if needed. */
  async validToken(): Promise<string | null> {
    if (this.state.accessToken && this.state.expiresAt - Date.now() > 30_000) return this.state.accessToken;
    if (this.state.status === 'anonymous') return null;
    return (await this.refresh()) ? this.state.accessToken : null;
  }
}

export const authStore = new AuthStore();
