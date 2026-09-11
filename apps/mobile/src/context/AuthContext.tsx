import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { AppState, View } from 'react-native'
import { accessToken, endSession, establishSession, expireIdleSession, hydrateSession, observeSession, recordActivity, sessionSnapshot } from '@/lib/session'
import { loginApi, registerApi } from '@/lib/api'
import type { AuthUser, AuthTokens } from '@/lib/api'

interface AuthState {
  user: AuthUser | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (data: {
    name: string
    email: string
    password: string
    country?: string
    role?: string
    organizationName?: string
    organizationType?: string
    registrationNumber?: string
    referralCode?: string
  }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: true,
  })

  useEffect(() => {
    let mounted = true
    const sync = () => {
      if (!mounted) return
      const session = sessionSnapshot()
      setState({ user: session?.user ?? null, tokens: session?.tokens ?? null, isAuthenticated: !!session, isLoading: false })
    }
    const unsubscribe = observeSession(sync)
    void hydrateSession().then(async () => { sync(); try { await accessToken() } catch { /* Offline sessions are retained. */ } }).catch(sync)
    const tick = () => { if (!expireIdleSession() && AppState.currentState === 'active') void accessToken().catch(() => {}) }
    const timer = setInterval(tick, 30000)
    const appState = AppState.addEventListener('change', value => { if (value === 'active') tick() })
    return () => { mounted = false; unsubscribe(); clearInterval(timer); appState.remove() }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { user, tokens } = await loginApi(email, password)
    await establishSession(user, tokens)
    setState({ user, tokens, isAuthenticated: true, isLoading: false })

  }, [])

  const register = useCallback(async (data: {
    name: string
    email: string
    password: string
    country?: string
    role?: string
    organizationName?: string
    organizationType?: string
    registrationNumber?: string
    referralCode?: string
  }) => {
    const { user, tokens } = await registerApi(data)
    await establishSession(user, tokens)
    setState({ user, tokens, isAuthenticated: true, isLoading: false })

  }, [])

  const logout = useCallback(async () => {
    await endSession()
    setState({ user: null, tokens: null, isAuthenticated: false, isLoading: false })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      <View style={{ flex: 1 }} onTouchStart={recordActivity}>{children}</View>
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
