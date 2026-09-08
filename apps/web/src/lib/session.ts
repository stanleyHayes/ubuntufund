export const SESSION_EXPIRED = 'uf:session-expired'

export function storedAccessToken(): string | null {
  try {
    return JSON.parse(localStorage.getItem('uf_tokens') ?? 'null')?.accessToken ?? localStorage.getItem('accessToken')
  } catch { return null }
}

/** A late response from an older session must never sign out a newer login. */
export function expireSession(rejectedToken: string): void {
  if (storedAccessToken() !== rejectedToken) return
  forceExpireSession()
}

/**
 * Hard-expire the current session regardless of token match — for a 401 on an
 * authed request where we hold no usable token to match against. Always leaves
 * the app in a signed-out state so a protected page shows the sign-in prompt
 * instead of a dead-end error.
 */
export function forceExpireSession(): void {
  for (const key of ['uf_user', 'uf_tokens', 'accessToken', 'refreshToken']) localStorage.removeItem(key)
  window.dispatchEvent(new Event(SESSION_EXPIRED))
}

export function tokenExpiresAt(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch { return null }
}
