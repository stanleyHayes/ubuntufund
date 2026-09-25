import { router } from 'expo-router'

const RETURN_TO_MAX = 512

/**
 * Accept a post-sign-in destination only when it is an in-app path: it must
 * start with a single '/', stay short, carry no backslashes or control
 * characters, and never point back at the sign-in screens. Anything else
 * (external URLs, protocol-relative '//host', arrays, non-strings) is dropped
 * so a crafted link cannot bounce a fresh session somewhere unexpected.
 */
export function safeReturnTo(value: unknown): string | null {
  const candidate = Array.isArray(value) ? value[0] : value
  if (typeof candidate !== 'string') return null
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.length > RETURN_TO_MAX) return null
  if (candidate.includes('\\') || /[\u0000-\u001f\u007f]/.test(candidate)) return null
  if (/^\/\(auth\)(\/|\?|$)/.test(candidate) || /^\/(login|register|forgot-password)(\/|\?|$)/.test(candidate)) return null
  return candidate
}

/**
 * Serialize the current route into a returnTo value. `segments` (from
 * useSegments) lets route params such as `[id]`, which are already part of the
 * pathname, be left out of the query string.
 */
export function currentHref(pathname: string, params: Record<string, string | string[] | undefined> = {}, segments: readonly string[] = []): string {
  const routeKeys = new Set(segments.filter(s => /^\[.+\]$/.test(s)).map(s => s.replace(/^\[(\.\.\.)?/, '').replace(/\]$/, '')))
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (routeKeys.has(key)) continue
    for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined) query.append(key, item)
  }
  const search = query.toString()
  return search ? `${pathname}?${search}` : pathname
}

/** Where a sign-in gate should send the user, keeping a safe destination for after sign-in. */
export function signInHref(returnTo?: string | null) {
  const target = safeReturnTo(returnTo)
  return target ? { pathname: '/(auth)/login' as const, params: { returnTo: target } } : '/(auth)/login' as const
}

/**
 * Leave the sign-in screens once signed in: back to the saved destination
 * (popping the sign-in screens off the stack when that screen is still under
 * them), or the Home tab when there is none.
 */
export function completeSignIn(returnTo: unknown) {
  const target = safeReturnTo(returnTo)
  if (target) router.dismissTo(target)
  else router.replace('/(tabs)')
}
