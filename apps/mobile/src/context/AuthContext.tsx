import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { loginApi, registerApi, refreshTokenApi } from '@/lib/api'
import type { AuthUser, AuthTokens } from '@/lib/api'
import {
  registerForPushNotificationsAsync,
  registerPushTokenWithApi,
} from '@/services/notifications'

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
  }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_USER_KEY = 'uf_user'
const STORAGE_TOKENS_KEY = 'uf_tokens'

async function loadFromStorage(): Promise<{ user: AuthUser | null; tokens: AuthTokens | null }> {
  try {
    const [userRaw, tokensRaw] = await Promise.all([
      AsyncStorage.getItem(STORAGE_USER_KEY),
      AsyncStorage.getItem(STORAGE_TOKENS_KEY),
    ])
    return {
      user: userRaw ? JSON.parse(userRaw) : null,
      tokens: tokensRaw ? JSON.parse(tokensRaw) : null,
    }
  } catch {
    return { user: null, tokens: null }
  }
}

async function saveToStorage(user: AuthUser, tokens: AuthTokens) {
  await Promise.all([
    AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user)),
    AsyncStorage.setItem(STORAGE_TOKENS_KEY, JSON.stringify(tokens)),
  ])
}

async function clearStorage() {
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_USER_KEY),
    AsyncStorage.removeItem(STORAGE_TOKENS_KEY),
  ])
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: true,
  })

  // Hydrate from storage on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { user, tokens } = await loadFromStorage()

      if (cancelled) return

      if (!user || !tokens?.refreshToken) {
        setState({ user: null, tokens: null, isAuthenticated: false, isLoading: false })
        return
      }

      // Try to refresh the token
      try {
        const newTokens = await refreshTokenApi(tokens.refreshToken)
        await saveToStorage(user, newTokens)
        if (!cancelled) {
          setState({ user, tokens: newTokens, isAuthenticated: true, isLoading: false })
        }
      } catch {
        // Refresh failed — clear stale session
        await clearStorage()
        if (!cancelled) {
          setState({ user: null, tokens: null, isAuthenticated: false, isLoading: false })
        }
      }
    })()

    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { user, tokens } = await loginApi(email, password)
    await saveToStorage(user, tokens)
    setState({ user, tokens, isAuthenticated: true, isLoading: false })

    // Register push token after login — never allow this optional step to
    // surface an error into the auth flow.
    try {
      const pushToken = await registerForPushNotificationsAsync()
      if (pushToken) {
        const platform = Platform.OS === 'ios' ? 'ios' : 'android'
        await registerPushTokenWithApi(pushToken, platform)
      }
    } catch {
      // Push registration is non-critical.
    }
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
  }) => {
    const { user, tokens } = await registerApi(data)
    await saveToStorage(user, tokens)
    setState({ user, tokens, isAuthenticated: true, isLoading: false })

    // Register push token after registration
    const pushToken = await registerForPushNotificationsAsync()
    if (pushToken) {
      const platform = Platform.OS === 'ios' ? 'ios' : 'android'
      await registerPushTokenWithApi(pushToken, platform).catch(() => {
        // Silently fail — push registration is non-critical
      })
    }
  }, [])

  const logout = useCallback(async () => {
    await clearStorage()
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
