import type { LegalAcceptanceInput, LegalAcceptanceRecord } from '@ubuntu-fund/types'
import { accessToken, configureRefresh } from './session'
import { signalAgreementRequired } from './agreementEvents'

// In dev, the API runs on your machine. Android emulator uses 10.0.2.2 for localhost.
// iOS simulator and physical devices (with Expo) use the LAN IP.
// Adjust this to your machine's LAN IP if testing on a physical device.
import { Platform } from 'react-native'
import Constants from 'expo-constants'

// Expo development client on physical device: use the debugger host IP
// Android emulator: 10.0.2.2 maps to host localhost
// iOS simulator: localhost works directly
// Canonical port is 8100; override locally with EXPO_PUBLIC_API_PORT when the
// API runs elsewhere (e.g. 18100 when Docker occupies the 81xx range).
const API_PORT = process.env.EXPO_PUBLIC_API_PORT ?? '8100'

function getApiBase(): string {
  const configuredBase = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '')
  if (configuredBase) {
    if (!__DEV__ && !configuredBase.startsWith('https://')) {
      throw new Error('EXPO_PUBLIC_API_URL must use HTTPS in production')
    }
    return configuredBase.endsWith('/api/v1')
      ? configuredBase
      : `${configuredBase}/api/v1`
  }

  if (!__DEV__) {
    throw new Error('EXPO_PUBLIC_API_URL is required for production builds')
  }

  const expoHost = Constants.expoConfig?.hostUri?.split(':')[0]

  if (expoHost && expoHost !== 'localhost') {
    // Physical device via a development client — use the LAN IP
    return `http://${expoHost}:${API_PORT}/api/v1`
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${API_PORT}/api/v1`
  }

  return `http://localhost:${API_PORT}/api/v1`
}

export const API_BASE = getApiBase()

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface ApiOptions extends RequestInit {
  token?: string
}

/** Ordinary requests give up after this long (connection, headers and body). */
export const REQUEST_TIMEOUT_MS = 30_000
/** Uploads (up to 4 MB) get longer on slow mobile connections. */
export const UPLOAD_TIMEOUT_MS = 120_000
const NETWORK_ERROR = 'Could not reach Ujimora. Check your connection and try again.'
const TIMEOUT_ERROR = 'Ujimora took too long to respond. Check your connection and try again.'
const UNAVAILABLE_ERROR = 'Ujimora is temporarily unavailable. Please try again in a minute.'

interface RawResponse { status: number; ok: boolean; body: unknown }

/**
 * fetch + read the whole body under one deadline. Android's HTTP client has
 * no timeouts of its own, so a stalled request would otherwise hang (and keep
 * upload spinners and disabled buttons) forever. Network failures and
 * timeouts become ApiError(0, friendly message). The body is parsed only if
 * it is JSON; an HTML error page from a proxy yields `undefined`.
 */
async function send(url: string, init: RequestInit, timeoutMs: number): Promise<RawResponse> {
  const controller = new AbortController()
  const outer = init.signal
  const forward = () => controller.abort()
  if (outer) { if (outer.aborted) controller.abort(); else outer.addEventListener('abort', forward) }
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    const text = await res.text()
    let body: unknown = null
    if (text) { try { body = JSON.parse(text) } catch { body = undefined } }
    return { status: res.status, ok: res.ok, body }
  } catch (error) {
    if (timedOut) throw new ApiError(0, TIMEOUT_ERROR)
    if (outer?.aborted) throw error
    throw new ApiError(0, NETWORK_ERROR)
  } finally {
    clearTimeout(timer)
    outer?.removeEventListener('abort', forward)
  }
}

function failure({ status, body }: RawResponse): ApiError {
  const payload = body && typeof body === 'object' ? body as { message?: unknown; error?: unknown } : null
  const message = typeof payload?.message === 'string' ? payload.message : typeof payload?.error === 'string' ? payload.error : null
  return new ApiError(status, message ?? (status >= 500 ? UNAVAILABLE_ERROR : 'Request failed. Please try again.'))
}

function unwrap<T>({ status, body }: RawResponse): T {
  if (body === undefined) throw new ApiError(status, 'Unexpected response from Ujimora. Please try again.')
  // Unwrap the { data, message, status } envelope when present, matching the
  // web client. Callers receive the payload directly (never the envelope).
  return (body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body) as T
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...fetchOptions } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await send(`${API_BASE}${path}`, { ...fetchOptions, headers }, REQUEST_TIMEOUT_MS)
  // Check the status before trusting the body: a 502/503 page is HTML.
  if (!res.ok) {
    signalAgreementRequired(res.status)
    throw failure(res)
  }
  return unwrap<T>(res)
}

// --- Authenticated request helper ---

async function authedRequest<T>(path: string, options?: RequestInit, retried = false, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const token = await accessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const res = await send(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  }, timeoutMs)

  if (res.status === 401 && token && !retried) {
    const renewed = await accessToken(true)
    if (renewed) return authedRequest<T>(path, options, true, timeoutMs)
  }
  // Throw ApiError so callers can branch on `status` (e.g. treat a 404 as
  // "not enrolled"); it still extends Error, so `.message` catches keep working.
  if (!res.ok) {
    signalAgreementRequired(res.status)
    throw failure(res)
  }
  return unwrap<T>(res)
}

export const api = {
  patch: <T>(path: string, body?: unknown) => authedRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  upload: <T>(path: string, body: ArrayBuffer, contentType: string) => authedRequest<T>(path, { method: 'POST', body, headers: { 'Content-Type': contentType } }, false, UPLOAD_TIMEOUT_MS),
  get: <T>(path: string) => authedRequest<T>(path),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    authedRequest<T>(path, { method: 'POST', body: JSON.stringify(body), headers }),
  put: <T>(path: string, body?: unknown) =>
    authedRequest<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) =>
    authedRequest<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
}

// --- Auth types ---

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthUser {
  legalAcceptance?: LegalAcceptanceRecord
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
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, mfaCode }),
  })
}

export async function registerApi(data: {
  legalAcceptance?: LegalAcceptanceInput
  name: string
  email: string
  password: string
  country?: string
  role?: string
  website?: string
  needsWebsite?: boolean
  organizationName?: string
  organizationType?: string
  registrationNumber?: string
  referralCode?: string
}): Promise<RegisterResponse> {
  // request() unwraps the envelope, so this resolves to { user, tokens }.
  return request<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/** Server-side sign-out of the session this refresh token belongs to. */
export async function logoutApi(refreshToken: string): Promise<void> {
  await request<null>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })
}

export async function refreshTokenApi(refreshToken: string): Promise<AuthTokens> {
  return request<AuthTokens>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })
}

export { ApiError }

configureRefresh(refreshTokenApi)
