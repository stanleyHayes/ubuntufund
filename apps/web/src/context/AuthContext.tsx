import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { loginApi, registerApi, refreshTokenApi } from '@/lib/api'
import type { AuthUser, AuthTokens } from '@/lib/api'

interface AuthState {
  user: AuthUser | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (data: { name: string; email: string; password: string; country?: string; role?: string; organizationName?: string; organizationType?: string; registrationNumber?: string; website?: string }) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_USER_KEY = 'uf_user'
const STORAGE_TOKENS_KEY = 'uf_tokens'

function loadFromStorage(): { user: AuthUser | null; tokens: AuthTokens | null } {
  try {
    const user = JSON.parse(localStorage.getItem(STORAGE_USER_KEY) ?? 'null')
    const tokens = JSON.parse(localStorage.getItem(STORAGE_TOKENS_KEY) ?? 'null')
    return { user, tokens }
  } catch {
    return { user: null, tokens: null }
  }
}

function saveToStorage(user: AuthUser, tokens: AuthTokens) {
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user))
  localStorage.setItem(STORAGE_TOKENS_KEY, JSON.stringify(tokens))
}

function clearStorage() {
  localStorage.removeItem(STORAGE_USER_KEY)
  localStorage.removeItem(STORAGE_TOKENS_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const { user, tokens } = loadFromStorage()
    return {
      user,
      tokens,
      isAuthenticated: !!user && !!tokens,
      isLoading: false,
    }
  })

  // Try to refresh token on mount if we have stored tokens
  useEffect(() => {
    const { tokens } = loadFromStorage()
    if (!tokens?.refreshToken) return

    refreshTokenApi(tokens.refreshToken)
      .then((newTokens) => {
        const user = JSON.parse(localStorage.getItem(STORAGE_USER_KEY) ?? 'null')
        if (user) {
          saveToStorage(user, newTokens)
          setState({ user, tokens: newTokens, isAuthenticated: true, isLoading: false })
        }
      })
      .catch(() => {
        // Refresh failed — clear stale session
        clearStorage()
        setState({ user: null, tokens: null, isAuthenticated: false, isLoading: false })
      })
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { user, tokens } = await loginApi(email, password)
    saveToStorage(user, tokens)
    setState({ user, tokens, isAuthenticated: true, isLoading: false })
  }, [])

  const register = useCallback(async (data: { name: string; email: string; password: string; country?: string; role?: string; organizationName?: string; organizationType?: string; registrationNumber?: string; website?: string }) => {
    const { user, tokens } = await registerApi(data)
    saveToStorage(user, tokens)
    setState({ user, tokens, isAuthenticated: true, isLoading: false })
  }, [])

  const logout = useCallback(() => {
    clearStorage()
    setState({ user: null, tokens: null, isAuthenticated: false, isLoading: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
