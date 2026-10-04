import { authStore } from '@/lib/auth-store';
import { tokenStore } from './sso';

export const BASE_URL: string = import.meta.env['VITE_API_URL'] ?? '';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function withAuth(init: RequestInit | undefined, token: string | null): RequestInit {
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const qubToken = await authStore.validToken();
  const token = qubToken || tokenStore.get().accessToken;
  const response = await fetch(input, withAuth(init, token));

  if (response.status === 401 && qubToken) {
    if (await authStore.refresh()) {
      const refreshedToken = await authStore.validToken();
      return fetch(input, withAuth(init, refreshedToken));
    }
  }

  return response;
}

export async function requestJson<T>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<T> {
  const url = `${BASE_URL}/api/v3${path.startsWith('/') ? path : `/${path}`}`;
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  };

  const response = await authFetch(url, init);

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; code?: string };
    };
    throw new ApiError(response.status, err.error?.message ?? 'Request failed', err.error?.code);
  }

  if (response.status === 204) return undefined as T;
  const json = await response.json();
  if (json && typeof json === 'object' && 'data' in json && (json as { success?: boolean }).success === true) {
    return (json as { data: T }).data;
  }
  return json as T;
}
