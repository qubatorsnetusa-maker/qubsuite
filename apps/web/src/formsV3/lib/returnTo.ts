/**
 * Where to send the user after SSO sign-in.
 *
 * The SSO server forwards only `redirect_uri` and `app_name` (it drops a
 * separate `return_to`), but it redirects back to `redirect_uri` verbatim with
 * the tokens in the fragment. So the destination rides in the callback URL's
 * own query string: /callback?returnTo=/some/page#token=...
 */

/** Only same-site paths ("/page?x=1"), never "//host", "/\host" or "https://...". */
export function safeReturnPath(value: string | null | undefined): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : null
}

/** The `redirect_uri` to hand the SSO server: `${appUrl}/callback`, carrying `returnTo` if it's safe. */
export function ssoCallbackUrl(appUrl: string, returnTo?: string | null): string {
  const url = new URL(`${appUrl}/callback`)
  const path = safeReturnPath(returnTo)
  if (path) url.searchParams.set('returnTo', path)
  return url.toString()
}

/** On /callback: the destination from the URL, or `fallback` if absent or not a same-site path. */
export function callbackReturnTo(fallback: string): string {
  const params = new URLSearchParams(window.location.search)
  return safeReturnPath(params.get('returnTo') ?? params.get('return_to')) ?? fallback
}
