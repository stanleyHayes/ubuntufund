import { hasCurrentLegalAcceptance, type LegalAcceptanceInput, type LegalAcceptanceRecord } from '@ubuntu-fund/types'
import { SESSION_EXPIRED, browserSession } from '@/lib/session'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { AGREEMENT_REQUIRED, api, loginApi, registerApi } from '@/lib/api'
import { clearAllPublicationDrafts } from '@/lib/publicationDrafts'
import type { AuthUser, AuthTokens } from '@/lib/api'

interface AuthState {
  user: AuthUser | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
}

/** GET /profile/legal-acceptance: the API's view, which outranks this bundle's constant. */
interface LegalStatus {
  current: boolean
  requiredVersion: string
}

interface AuthContextValue extends AuthState {
  sessionExpired: boolean
  /** Whether the signed-in user has accepted the agreement version the API requires. */
  legalAcceptanceCurrent: boolean
  /** The version the API requires, once known; accept this one, not the bundled constant. */
  requiredLegalVersion?: string
  login: (email: string, password: string, mfaCode?: string) => Promise<void>
  register: (data: { legalAcceptance?: LegalAcceptanceInput; name: string; email: string; password: string; country?: string; role?: string; organizationName?: string; organizationType?: string; registrationNumber?: string; website?: string; needsWebsite?: boolean; referralCode?: string }) => Promise<void>
  updateLegalAcceptance: (legalAcceptance: LegalAcceptanceRecord) => void
  updateName: (name: string) => void
  replaceTokens: (tokens: AuthTokens, userId: string) => void
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

  // Refresh the agreement status from the server on sign-in, when the tab comes
  // back into view and after any 428, so a bundle older or newer than the API
  // cannot hide the notice or show it forever.
  // Keyed by user so a status fetched for one account never applies to the next.
  const [fetchedLegalStatus, setLegalStatus] = useState<(LegalStatus & { userId: string }) | null>(null)
  const signedInUserId = state.isAuthenticated ? state.user?.id : undefined
  const legalStatus = signedInUserId && fetchedLegalStatus?.userId === signedInUserId ? fetchedLegalStatus : null
  useEffect(() => {
    if (!signedInUserId) return
    let active = true, last = 0
    const refresh = (force = false) => {
      if (!force && Date.now() - last < 60_000) return
      last = Date.now()
      api.get<LegalStatus>('/profile/legal-acceptance').then(status => {
        if (active && typeof status?.current === 'boolean' && typeof status.requiredVersion === 'string') setLegalStatus({ userId: signedInUserId, current: status.current, requiredVersion: status.requiredVersion })
      }).catch(() => { /* Keep the cached view; the next focus retries. */ })
    }
    const focus = () => refresh()
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    const required = () => refresh(true)
    refresh(true)
    window.addEventListener('focus', focus)
    document.addEventListener('visibilitychange', visible)
    window.addEventListener(AGREEMENT_REQUIRED, required)
    return () => {
      active = false
      window.removeEventListener('focus', focus)
      document.removeEventListener('visibilitychange', visible)
      window.removeEventListener(AGREEMENT_REQUIRED, required)
    }
  }, [signedInUserId])

  useEffect(() => browserSession.start(() => {
    const { user, tokens } = loadFromStorage()
    setState({ user, tokens, isAuthenticated: !!user && !!tokens?.accessToken, isLoading: false })
  }), [])

  const login = useCallback(async (email: string, password: string, mfaCode?: string) => {
    const { user, tokens } = await loginApi(email, password, mfaCode)
    setSessionExpired(false)
    saveToStorage(user, tokens)
    setState({ user, tokens, isAuthenticated: true, isLoading: false })
  }, [])

  const register = useCallback(async (data: { legalAcceptance?: LegalAcceptanceInput; name: string; email: string; password: string; country?: string; role?: string; organizationName?: string; organizationType?: string; registrationNumber?: string; website?: string; needsWebsite?: boolean; referralCode?: string }) => {
    const { user, tokens } = await registerApi(data)
    setSessionExpired(false)
    saveToStorage(user, tokens)
    // Referral attributed — drop the stored code so it can't be reused.
    try { localStorage.removeItem('uf_ref') } catch { /* storage unavailable */ }
    setState({ user, tokens, isAuthenticated: true, isLoading: false })
  }, [])

  const updateLegalAcceptance = useCallback((legalAcceptance: LegalAcceptanceRecord) => {
    setLegalStatus(previous => previous && ({ ...previous, current: previous.requiredVersion === legalAcceptance.version && legalAcceptance.acceptedTerms && legalAcceptance.ageConfirmed }))
    setState(previous => {
      if (!previous.user) return previous
      const user = { ...previous.user, legalAcceptance }
      try { localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user)) } catch { /* Current session still updates. */ }
      return { ...previous, user }
    })
  }, [])

  const updateName = useCallback((name: string) => {
    setState(previous => {
      if (!previous.user) return previous
      const user = { ...previous.user, name }
      try { localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user)) } catch { /* Current session still updates. */ }
      return { ...previous, user }
    })
  }, [])

  const replaceTokens = useCallback((tokens: AuthTokens, userId: string) => {
    setState(previous => {
      if (!previous.user || previous.user.id !== userId) return previous
      saveToStorage(previous.user, tokens)
      return { ...previous, tokens }
    })
  }, [])

  const logout = useCallback(() => {
    browserSession.revokeOnServer()
    clearStorage()
    clearAllPublicationDrafts()
    setSessionExpired(false)
    setState({ user: null, tokens: null, isAuthenticated: false, isLoading: false })
  }, [])

  return (
    <AuthContext.Provider value={{
      ...state, sessionExpired, login, register, replaceTokens, updateName, updateLegalAcceptance, logout,
      legalAcceptanceCurrent: legalStatus?.current ?? hasCurrentLegalAcceptance(state.user?.legalAcceptance),
      requiredLegalVersion: legalStatus?.requiredVersion,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
