// Client for Qubator SSO. Qub Forms no longer authenticates users itself —
// sign-in happens on Qub-SSO's hosted login page, which hands back an
// access/refresh token pair as a URL fragment (see /callback route).
// This module owns everything about that handoff: building the redirect
// URLs, storing the resulting tokens, and refreshing/revoking them.

import { ssoCallbackUrl } from '../lib/returnTo'

export interface SsoUser {
  id: string
  username: string
  email: string
  roles: string[]
}

const CONFIG = {
  // Qubator SSO is a single TanStack Start app (no separate API service),
  // so the server and hosted login page share one origin/port.
  SSO_SERVER: import.meta.env['VITE_SSO_SERVER_URL'] ?? 'http://localhost:4001',
  SSO_LOGIN_URL: import.meta.env['VITE_SSO_LOGIN_URL'] ?? 'http://localhost:4001/login',
  SSO_REGISTER_URL: import.meta.env['VITE_SSO_REGISTER_URL'] ?? 'http://localhost:4001/register',
  APP_URL: import.meta.env['VITE_APP_URL'] ?? (typeof window !== 'undefined' ? window.location.origin : ''),
  APP_NAME: import.meta.env['VITE_APP_NAME'] ?? 'Qub Forms',
}

const ACCESS_TOKEN_KEY = 'sso_access_token'
const REFRESH_TOKEN_KEY = 'sso_refresh_token'

export const tokenStore = {
  get(): { accessToken: string | null; refreshToken: string | null } {
    return {
      accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
      refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
    }
  },
  set(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  },
  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}

export interface CallbackTokens {
  accessToken: string
  refreshToken: string
}

// Parses the `#token=...&refresh_token=...` fragment Qub-SSO's hosted login
// page appends to redirect_uri on successful sign-in (see
// Qub-SSO apps/web/src/features/login/index.tsx:43-55). Returns null if
// either token is missing, e.g. someone navigates to /callback directly.
export function parseCallbackFragment(hash: string): CallbackTokens | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)
  const accessToken = params.get('token')
  const refreshToken = params.get('refresh_token')
  if (!accessToken || !refreshToken) return null
  return { accessToken, refreshToken }
}

function buildRedirectUrl(base: string, returnTo?: string): string {
  // SSO echoes redirect_uri back verbatim but drops return_to, so returnTo rides in it.
  const redirectUri = ssoCallbackUrl(CONFIG.APP_URL, returnTo)
  const url = new URL(base)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('app_name', CONFIG.APP_NAME)
  return url.toString()
}

export function buildLoginUrl(returnTo?: string): string {
  return buildRedirectUrl(CONFIG.SSO_LOGIN_URL, returnTo)
}

export function buildRegisterUrl(returnTo?: string): string {
  return buildRedirectUrl(CONFIG.SSO_REGISTER_URL, returnTo)
}

export function redirectToLogin(returnTo?: string): void {
  window.location.href = buildLoginUrl(returnTo)
}

export function redirectToRegister(returnTo?: string): void {
  window.location.href = buildRegisterUrl(returnTo)
}

export async function verifySsoToken(token: string): Promise<SsoUser | null> {
  try {
    const res = await fetch(`${CONFIG.SSO_SERVER}/api/auth/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.valid ? (data.user as SsoUser) : null
  } catch {
    return null
  }
}

let refreshPromise: Promise<string | null> | null = null

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise

  const { refreshToken } = tokenStore.get()
  if (!refreshToken) return null

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${CONFIG.SSO_SERVER}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!res.ok) return null
      const data = await res.json()
      const newAccessToken: string | undefined = data.access_token ?? data.accessToken
      if (!newAccessToken) return null
      const newRefreshToken: string = data.refresh_token ?? data.refreshToken ?? refreshToken
      tokenStore.set(newAccessToken, newRefreshToken)
      return newAccessToken
    } catch {
      return null
    }
  })()

  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

export async function ssoLogout(): Promise<void> {
  const { refreshToken } = tokenStore.get()
  try {
    if (refreshToken) {
      await fetch(`${CONFIG.SSO_SERVER}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
    }
  } catch {
    // best-effort — always clear local state below regardless
  } finally {
    tokenStore.clear()
  }
}
