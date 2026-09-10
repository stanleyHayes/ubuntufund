import { browserSession } from './session'
// In production, requests go to '/api/v1' which Vercel rewrites to the API
// (see vercel.json). Set VITE_API_URL to call an absolute API origin instead.
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
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
  if (res.status === 401 && !isPublicAuth) {
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
    throw new Error(err?.message || err?.error || fallback)
  }
  const json = await res.json()
  return json !== null && typeof json === 'object' && Object.prototype.hasOwnProperty.call(json, 'data') ? json.data : json
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
