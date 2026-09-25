import type { LegalAcceptanceInput, LegalAcceptanceRecord } from '@ubuntu-fund/types'
import { browserSession, expireSession, forceExpireSession, storedAccessToken } from './session'
// In production, requests go to '/api/v1' which Vercel rewrites to the API
// (see vercel.json). Set VITE_API_URL to call an absolute API origin instead.
export const API_BASE = import.meta.env?.VITE_API_URL || '/api/v1'

/**
 * Dispatched when the API answers 428 (a publishing action needs a current
 * agreement). AuthContext then re-reads the server's agreement status, because
 * this bundle's LEGAL_ACCEPTANCE_VERSION can lag the API's.
 */
export const AGREEMENT_REQUIRED = 'ujimora:agreement-required'
function signalAgreementRequired(status: number) {
  if (status === 428 && typeof window !== 'undefined') window.dispatchEvent(new Event(AGREEMENT_REQUIRED))
}

interface ApiOptions extends RequestInit {
  token?: string
}

/**
 * `Content-Type: application/json` only when a body is sent. The API is a
 * separate origin, and a bodyless anonymous GET with no custom headers is a
 * CORS "simple" request, so public browsing (campaign lists and pages) skips
 * the preflight round trip entirely.
 */
function jsonHeaders(body: RequestInit['body']): Record<string, string> {
  return body === undefined || body === null ? {} : { 'Content-Type': 'application/json' }
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Field or reason details the API attached to the error (`errors`). */
    public errors?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * The API rejected a session token with 401. It may only look valid here
 * because the device clock is off, so renew once before giving up. Resolves to
 * the new token, or null when the session has ended (already expired locally).
 */
async function renewAfter401(token: string): Promise<string | null> {
  try {
    return await browserSession.forceRefresh(token)
  } catch {
    // A network failure while renewing is not a sign-out.
    throw new ApiError(0, 'Unable to renew your session. Check your connection and try again.')
  }
}

async function request<T>(path: string, options: ApiOptions = {}, retried = false): Promise<T> {
  const { token: suppliedToken, headers: customHeaders, ...fetchOptions } = options
  const managed = !!suppliedToken && suppliedToken === storedAccessToken()
  const token = managed ? await browserSession.ensureAccessToken() : suppliedToken
  if (suppliedToken && !token) throw new ApiError(401, 'Your session has expired. Please sign in again.')

  const headers: Record<string, string> = {
    ...jsonHeaders(fetchOptions.body),
    ...customHeaders as Record<string, string>,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
    })
  } catch {
    throw new ApiError(0, 'Unable to connect to Ujimora. Check your connection and try again.')
  }

  const body = await res.text()
  let data: { error?: string; message?: string } | T | null = null
  if (body.trim()) {
    try {
      data = JSON.parse(body) as { error?: string; message?: string } | T
    } catch {
      if (res.ok) throw new ApiError(res.status, 'Ujimora returned an invalid response. Please try again.')
    }
  }

  if (!res.ok) {
    signalAgreementRequired(res.status)
    if (res.status === 401 && managed && token && !retried) {
      const renewed = await renewAfter401(token)
      if (renewed && renewed !== token) return request<T>(path, { ...options, token: renewed }, true)
    }
    if (res.status === 401 && token) expireSession(token)
    const errorBody = data && typeof data === 'object' ? data as { error?: string; message?: string; errors?: Record<string, string[]> } : null
    const fallback = res.status === 401
      ? 'The email or password is incorrect.'
      : res.status === 429
        ? 'Too many attempts. Please wait a moment and try again.'
        : res.status >= 500
          ? 'Ujimora is temporarily unavailable. Please try again shortly.'
          : 'We could not complete your request. Please try again.'
    const details = errorBody?.errors && typeof errorBody.errors === 'object' ? errorBody.errors : undefined
    throw new ApiError(res.status, errorBody?.error ?? errorBody?.message ?? fallback, details)
  }

  if (data === null) throw new ApiError(res.status, 'Ujimora returned an empty response. Please try again.')
  return data as T
}

// ---------------------------------------------------------------------------
// Generic authenticated API client
// Reads the access token from localStorage and attaches it automatically.
// Responses are expected to follow { data: T, ... } – the client unwraps `.data`.
// ---------------------------------------------------------------------------

async function authedRequest<T>(path: string, options?: RequestInit, retried = false): Promise<T> {
  const hadToken = storedAccessToken()
  const token = await browserSession.ensureAccessToken()
  if (hadToken && !token) throw new ApiError(401, 'Your session has expired. Please sign in again.')

  const headers: Record<string, string> = {
    ...jsonHeaders(options?.body),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  })

  if (res.status === 401 && token && !retried) {
    // Renew once and retry before treating the 401 as a sign-out.
    const renewed = await renewAfter401(token)
    if (renewed && renewed !== token) return authedRequest<T>(path, options, true)
  }
  if (!res.ok) {
    signalAgreementRequired(res.status)
    // Any 401 on an authed request means this session can no longer act — expire
    // it so protected pages fall back to the sign-in prompt instead of a
    // dead-end error. Guarded by the token we actually sent (so a late reply
    // from an old token can't sign out a fresher login); if we sent none, hard
    // expire. Throw ApiError so callers can react to the status (e.g. 401).
    if (res.status === 401) {
      if (token) expireSession(token)
      else forceExpireSession()
    }
    const error = await res.json().catch(() => ({ message: 'Request failed' }))
    throw new ApiError(res.status, error.message ?? error.error ?? `HTTP ${res.status}`)
  }

  const json = await res.json()
  // Unwrap { data: T } envelope when present, otherwise return raw
  return (json.data !== undefined ? json.data : json) as T
}

export const api = {
  get: <T>(path: string) => authedRequest<T>(path),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    authedRequest<T>(path, { method: 'POST', body: JSON.stringify(body), headers }),
  put: <T>(path: string, body?: unknown) =>
    authedRequest<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) =>
    authedRequest<T>(path, { method: 'DELETE', ...(body === undefined ? {} : { body: JSON.stringify(body) }) }),
}

// --- Auth types ---

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthUser {
  legalAcceptance?: LegalAcceptanceRecord
  needsWebsite?: boolean
  organizationName?: string
  id: string
  name: string
  email: string
  role: string
}

export interface LoginResponse {
  user: AuthUser
  tokens: AuthTokens
}

export interface RegisterResponse {
  user: AuthUser
  tokens: AuthTokens
}

// --- Auth API ---

export async function loginApi(email: string, password: string, mfaCode?: string): Promise<LoginResponse> {
  const res = await request<{ data: LoginResponse }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, mfaCode }),
  })
  return res.data
}

export async function registerApi(data: {
  legalAcceptance?: LegalAcceptanceInput
  name: string
  email: string
  password: string
  country?: string
  role?: string
  needsWebsite?: boolean
  organizationName?: string
  organizationType?: string
  registrationNumber?: string
  website?: string
  referralCode?: string
}): Promise<RegisterResponse> {
  const res = await request<{ data: RegisterResponse }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data
}


export { request, ApiError }
