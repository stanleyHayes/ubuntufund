import { SESSION_EXPIRED, browserSession } from '@/lib/session'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { loginApi, registerApi } from '@/lib/api'
import type { AuthUser, AuthTokens } from '@/lib/api'

interface AuthState {
  user: AuthUser | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  sessionExpired: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: { name: string; email: string; password: string; country?: string; role?: string; organizationName?: string; organizationType?: string; registrationNumber?: string; website?: string; referralCode?: string }) => Promise<void>
  updateName: (name: string) => void
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
  browserSession.resetActivity()
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user))
  localStorage.setItem(STORAGE_TOKENS_KEY, JSON.stringify(tokens))
}

function clearStorage() { browserSession.clear() }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionExpired, setSessionExpired] = useState(false)
  const [state, setState] = useState<AuthState>(() => {
    const { user, tokens } = loadFromStorage()
    return {
      user,
      tokens,
      // Require a real access token — a tokens object that exists but carries no
      // usable access token must NOT read as authenticated (it would let a
      // protected page mount, 401, and dead-end instead of prompting sign-in).
      isAuthenticated: !!user && !!tokens?.accessToken,
      isLoading: false,
    }
  })

  useEffect(() => {
    const expired = () => {
      setSessionExpired(true)
      setState({ user: null, tokens: null, isAuthenticated: false, isLoading: false })
    }
    window.addEventListener(SESSION_EXPIRED, expired)
    return () => window.removeEventListener(SESSION_EXPIRED, expired)
  }, [])

  useEffect(() => browserSession.start(() => {
    const { user, tokens } = loadFromStorage()
    setState({ user, tokens, isAuthenticated: !!user && !!tokens?.accessToken, isLoading: false })
  }), [])

  const login = useCallback(async (email: string, password: string) => {
    const { user, tokens } = await loginApi(email, password)
    setSessionExpired(false)
    saveToStorage(user, tokens)
    setState({ user, tokens, isAuthenticated: true, isLoading: false })
  }, [])

  const register = useCallback(async (data: { name: string; email: string; password: string; country?: string; role?: string; organizationName?: string; organizationType?: string; registrationNumber?: string; website?: string; referralCode?: string }) => {
    const { user, tokens } = await registerApi(data)
    setSessionExpired(false)
    saveToStorage(user, tokens)
    // Referral attributed — drop the stored code so it can't be reused.
    try { localStorage.removeItem('uf_ref') } catch { /* storage unavailable */ }
    setState({ user, tokens, isAuthenticated: true, isLoading: false })
  }, [])

  const updateName = useCallback((name: string) => {
    setState(previous => {
      if (!previous.user) return previous
      const user = { ...previous.user, name }
      try { localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user)) } catch { /* Current session still updates. */ }
      return { ...previous, user }
    })
  }, [])

  const logout = useCallback(() => {
    clearStorage()
    setSessionExpired(false)
    setState({ user: null, tokens: null, isAuthenticated: false, isLoading: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, sessionExpired, login, register, updateName, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
