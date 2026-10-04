import type { ApiErrorBody, ErrorCode } from '@qub/shared';
import { authStore } from './auth-store';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Per-field messages from 422 responses (`details.fieldErrors`). */
  get fieldErrors(): Record<string, string> {
    const d = this.details as { fieldErrors?: Record<string, string | string[]> } | undefined;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(d?.fieldErrors ?? {})) out[k] = Array.isArray(v) ? v[0]! : v;
    return out;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  signal?: AbortSignal;
  /** Skip attaching the bearer token (public endpoints). */
  anonymous?: boolean;
}

export function buildUrl(path: string, query?: Query): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return `/api${path}${s ? `?${s}` : ''}`;
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return new ApiError(res.status, body.error.code, body.error.message, body.error.details);
  } catch {
    return new ApiError(res.status, 'INTERNAL_ERROR', res.statusText || 'Request failed');
  }
}

/**
 * Typed fetch wrapper. Unwraps `{ success, data }`, attaches the access token, transparently refreshes it once
 * on 401, and turns error envelopes into ApiError.
 */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = async (token: string | null) =>
    fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      credentials: 'include',
      signal: options.signal,
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let res: Response;
  try {
    const token = options.anonymous ? null : await authStore.validToken();
    res = await send(token);
    if (res.status === 401 && !options.anonymous && authStore.get().status === 'authenticated') {
      if (await authStore.refresh()) res = await send(authStore.get().accessToken);
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'You appear to be offline. Check your connection and try again.');
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return ((await res.json()) as { data: T }).data;
}

/** Multipart upload with progress (fetch has no upload progress events, so XHR is used). */
export function uploadFile<T>(path: string, file: File, opts: { query?: Query; onProgress?: (fraction: number) => void; signal?: AbortSignal; anonymous?: boolean } = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    void (async () => {
      const token = opts.anonymous ? null : await authStore.validToken();
      const xhr = new XMLHttpRequest();
      xhr.open('POST', buildUrl(path, opts.query));
      xhr.withCredentials = true;
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) opts.onProgress?.(e.loaded / e.total);
      };
      xhr.onload = () => {
        let body: { success: boolean; data?: T; error?: ApiErrorBody['error'] } | null = null;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          body = null;
        }
        if (xhr.status >= 200 && xhr.status < 300 && body?.success) resolve(body.data as T);
        else reject(new ApiError(xhr.status, body?.error?.code ?? 'INTERNAL_ERROR', body?.error?.message ?? 'Upload failed', body?.error?.details));
      };
      xhr.onerror = () => reject(new ApiError(0, 'NETWORK_ERROR', 'Upload failed: network error.'));
      xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
      opts.signal?.addEventListener('abort', () => xhr.abort());
      const form = new FormData();
      form.append('file', file, file.name);
      xhr.send(form);
    })();
  });
}

/** WebSocket URL on the current origin, authenticated with a fresh access token. */
export async function socketUrl(path: string): Promise<string> {
  const token = await authStore.validToken();
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/api/ws${path}?token=${encodeURIComponent(token ?? '')}`;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}
