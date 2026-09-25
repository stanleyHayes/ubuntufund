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

/** Serialize a route path plus its search params into a returnTo value. */
export function currentHref(pathname: string, params: Record<string, string | string[] | undefined> = {}): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
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

/** Where to go once signed in: the saved destination, or the Home tab. */
export function afterSignIn(returnTo: unknown): string {
  return safeReturnTo(returnTo) ?? '/(tabs)'
}
