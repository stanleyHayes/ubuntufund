const API_BASE = '/api/v1'

interface ApiOptions extends RequestInit {
  token?: string
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...fetchOptions } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders as Record<string, string>,
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

// ---------------------------------------------------------------------------
// Generic authenticated API client
// Reads the access token from localStorage and attaches it automatically.
// Responses are expected to follow { data: T, ... } – the client unwraps `.data`.
// ---------------------------------------------------------------------------

async function authedRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('accessToken')
    ?? (() => {
      try {
        const tokens = JSON.parse(localStorage.getItem('uf_tokens') ?? 'null')
        return tokens?.accessToken ?? null
      } catch {
        return null
      }
    })()

  const isDemo = token === 'demo-access-token'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  })

  if (!res.ok) {
    // Demo accounts use a fake token the API rejects —
    // return empty data instead of surfacing auth errors
    if (isDemo && res.status === 401) {
      return [] as unknown as T
    }
    const error = await res.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message ?? error.error ?? `HTTP ${res.status}`)
  }

  const json = await res.json()
  // Unwrap { data: T } envelope when present, otherwise return raw
  return (json.data !== undefined ? json.data : json) as T
}

export const api = {
  get: <T>(path: string) => authedRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    authedRequest<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    authedRequest<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) =>
    authedRequest<T>(path, { method: 'DELETE' }),
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
    // Fallback to demo credentials when API is unreachable
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
  website?: string
}): Promise<RegisterResponse> {
  const res = await request<{ data: RegisterResponse }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data
}

export async function refreshTokenApi(refreshToken: string): Promise<AuthTokens> {
  // Demo tokens don't need refresh
  if (refreshToken === 'demo-refresh-token') {
    return { accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token' }
  }
  const res = await request<{ data: AuthTokens }>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  })
  return res.data
}

export { request, ApiError }
