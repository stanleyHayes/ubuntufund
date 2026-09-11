import { accessToken, configureRefresh } from './session'

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

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...fetchOptions } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  })

  const json = await res.json()

  if (!res.ok) {
    throw new ApiError(res.status, json.error ?? json.message ?? 'Request failed')
  }

  // Unwrap the { data, message, status } envelope when present, matching the
  // web client. Callers receive the payload directly (never the envelope).
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as T
}

// --- Authenticated request helper ---

async function authedRequest<T>(path: string, options?: RequestInit, retried = false): Promise<T> {
  const token = await accessToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  })

  if (res.status === 401 && token && !retried) {
    const renewed = await accessToken(true)
    if (renewed) return authedRequest<T>(path, options, true)
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }))
    // Throw ApiError so callers can branch on `status` (e.g. treat a 404 as
    // "not enrolled"); it still extends Error, so `.message` catches keep working.
    throw new ApiError(res.status, error.message ?? error.error ?? `HTTP ${res.status}`)
  }

  const json = await res.json()
  // Unwrap the { data, message, status } envelope when present, matching the
  // web client. Callers receive the payload directly (never the envelope).
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as T
}

export const api = {
  patch: <T>(path: string, body?: unknown) => authedRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  upload: <T>(path: string, body: ArrayBuffer, contentType: string) => authedRequest<T>(path, { method: 'POST', body, headers: { 'Content-Type': contentType } }),
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

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function registerApi(data: {
  name: string
  email: string
  password: string
  country?: string
  role?: string
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

export async function refreshTokenApi(refreshToken: string): Promise<AuthTokens> {
  return request<AuthTokens>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })
}

export { ApiError }

configureRefresh(refreshTokenApi)
