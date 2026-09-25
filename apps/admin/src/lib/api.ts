import { browserSession } from './session'
// In production, requests go to '/api/v1' which Vercel rewrites to the API
// (see vercel.json). Set VITE_API_URL to call an absolute API origin instead.
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

/** A non-2xx API answer, with the HTTP status and any field errors the server sent. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly errors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestFlags {
  /**
   * The request re-checks the admin's password or authenticator code. The API
   * answers a wrong one with 401, which here means "try again", not "session
   * ended": never renew-and-replay it (that counts the attempt twice against
   * the MFA and rate limits) and never sign out over it.
   */
  credentialCheck?: boolean
}

async function request<T>(path: string, options?: RequestInit, retried = false, flags: RequestFlags = {}): Promise<T> {
  const isPublicAuth = ['/auth/login', '/auth/forgot-password', '/auth/reset-password'].includes(path)
  const token = isPublicAuth ? null : await browserSession.ensureAccessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  // An expired/absent session (401 = bad or missing token, distinct from a 403
  // permission denial) should bounce to login rather than leave the page throwing
  // silent errors — e.g. the TopBar's notification poll spamming the console.
  // A credential check sent with a token reports its 401 like any other error;
  // if the session really ended, the next ordinary request signs out.
  if (res.status === 401 && !isPublicAuth && !(flags.credentialCheck && token)) {
    if (token && !retried) {
      // The token may only look valid here because the device clock is off:
      // renew once and retry before treating the 401 as a sign-out.
      let renewed: string | null
      try { renewed = await browserSession.forceRefresh(token) }
      catch { throw new Error('Unable to renew your session. Check your connection and try again.') }
      if (renewed && renewed !== token) return request<T>(path, options, true, flags)
    }
    browserSession.expire(token ?? undefined)
    if (!browserSession.accessToken() && !window.location.pathname.startsWith('/login')) {
      window.location.assign('/login')
    }
    throw new Error('Your session has expired. Please sign in again.')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    const fallback = res.status === 401
      ? 'The email or password is incorrect. Please try again.'
      : res.status === 404
      ? 'This API endpoint is unavailable (404). Refresh and try again.'
      : res.status === 403
        ? 'Your account does not have permission to perform this action.'
        : res.status >= 500
          ? 'The server could not complete this request. Please try again.'
          : `Request failed (HTTP ${res.status}).`
    throw new ApiError(err?.message || err?.error || fallback, res.status, err?.errors && typeof err.errors === 'object' ? err.errors : undefined)
  }
  const json = await res.json()
  return json !== null && typeof json === 'object' && Object.prototype.hasOwnProperty.call(json, 'data') ? json.data : json
}

export const api = {
  get: <T>(path: string, options?: Pick<RequestInit, 'signal'>) => request<T>(path, options),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

/**
 * Client for forms that re-enter the admin's password or authenticator code
 * (authenticator setup, enable, disable and new recovery codes). A wrong
 * password or code comes back as an ordinary error the admin can correct,
 * without a session renewal, a replayed attempt or a sign-out. A stable
 * object, so components that depend on the client identity do not reload.
 */
export const credentialApi = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }, false, { credentialCheck: true }),
}
