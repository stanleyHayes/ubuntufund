import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { api } from '@/lib/api'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
}

interface AuthTokens {
  accessToken: string
  refreshToken: string
}

interface AuthState {
  user: AuthUser | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_USER_KEY = 'uf_admin_user'
const STORAGE_TOKEN_KEY = 'uf_admin_token'
const STORAGE_TOKENS_KEY = 'uf_admin_tokens'

function loadFromStorage(): { user: AuthUser | null; tokens: AuthTokens | null } {
  try {
    const user = JSON.parse(localStorage.getItem(STORAGE_USER_KEY) ?? 'null')
    const tokensStr = localStorage.getItem(STORAGE_TOKENS_KEY)
    const tokens = tokensStr ? JSON.parse(tokensStr) : null
    return { user, tokens }
  } catch {
    return { user: null, tokens: null }
  }
}

function saveToStorage(user: AuthUser, tokens: AuthTokens) {
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user))
  localStorage.setItem(STORAGE_TOKENS_KEY, JSON.stringify(tokens))
  localStorage.setItem(STORAGE_TOKEN_KEY, tokens.accessToken)
}

function clearStorage() {
  localStorage.removeItem(STORAGE_USER_KEY)
  localStorage.removeItem(STORAGE_TOKENS_KEY)
  localStorage.removeItem(STORAGE_TOKEN_KEY)
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

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ user: AuthUser; tokens: AuthTokens }>('/auth/login', { email, password })
    saveToStorage(res.user, res.tokens)
    setState({ user: res.user, tokens: res.tokens, isAuthenticated: true, isLoading: false })
  }, [])

  const logout = useCallback(() => {
    clearStorage()
    setState({ user: null, tokens: null, isAuthenticated: false, isLoading: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
