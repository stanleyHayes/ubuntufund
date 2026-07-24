import AsyncStorage from '@react-native-async-storage/async-storage'

// In dev, the API runs on your machine. Android emulator uses 10.0.2.2 for localhost.
// iOS simulator and physical devices (with Expo) use the LAN IP.
// Adjust this to your machine's LAN IP if testing on a physical device.
import { Platform } from 'react-native'
import Constants from 'expo-constants'

// Expo Go on physical device: use the debugger host IP
// Android emulator: 10.0.2.2 maps to host localhost
// iOS simulator: localhost works directly
// Canonical port is 8100; override locally with EXPO_PUBLIC_API_PORT when the
// API runs elsewhere (e.g. 18100 when Docker occupies the 81xx range).
const API_PORT = process.env.EXPO_PUBLIC_API_PORT ?? '8100'

function getApiBase(): string {
  const expoHost = Constants.expoConfig?.hostUri?.split(':')[0]

  if (expoHost && expoHost !== 'localhost') {
    // Physical device via Expo Go — use the LAN IP
    return `http://${expoHost}:${API_PORT}/api/v1`
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${API_PORT}/api/v1`
  }

  return `http://localhost:${API_PORT}/api/v1`
}

const API_BASE = getApiBase()

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

  const data = await res.json()

  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? data.message ?? 'Request failed')
  }

  return data as T
}

// --- Authenticated request helper ---

async function authedRequest<T>(path: string, options?: RequestInit): Promise<T> {
  let token: string | null = null
  let isDemo = false
  try {
    const tokensRaw = await AsyncStorage.getItem('uf_tokens')
    const tokens = tokensRaw ? JSON.parse(tokensRaw) : null
    token = tokens?.accessToken ?? null
    isDemo = token === 'demo-access-token'
  } catch {
    // ignore
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  })

  if (!res.ok) {
    // Demo accounts get a fake token that the real API rejects —
    // return empty/default data instead of surfacing "authentication required"
    if (isDemo && res.status === 401) {
      return [] as unknown as T
    }
    const error = await res.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message ?? error.error ?? `HTTP ${res.status}`)
  }

  const json = await res.json()
  return (json.data !== undefined ? json.data : json) as T
}

export const api = {
  get: <T>(path: string) => authedRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    authedRequest<T>(path, { method: 'POST', body: JSON.stringify(body) }),
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

// --- Demo credentials (fallback when API is unavailable) ---

const DEMO_ACCOUNTS: Record<string, { password: string; user: AuthUser }> = {
  'demo@ubuntufund.com': {
    password: 'ubuntu2026',
    user: { id: 'demo-user-1', name: 'Amara Osei', email: 'demo@ubuntufund.com', role: 'user' },
  },
}

function demoLogin(email: string, password: string): LoginResponse | null {
  const account = DEMO_ACCOUNTS[email]
  if (account && account.password === password) {
    return {
      user: account.user,
      tokens: { accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token' },
    }
  }
  return null
}

// --- Auth API ---

export async function loginApi(email: string, password: string): Promise<LoginResponse> {
  try {
    const res = await request<{ data: LoginResponse }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    return res.data
  } catch (err) {
    const demo = demoLogin(email, password)
    if (demo) return demo
    throw err
  }
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
}): Promise<RegisterResponse> {
  const res = await request<{ data: RegisterResponse }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data
}

export async function refreshTokenApi(refreshToken: string): Promise<AuthTokens> {
  if (refreshToken === 'demo-refresh-token') {
    return { accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token' }
  }
  return request<AuthTokens>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })
}

export { request, ApiError }
