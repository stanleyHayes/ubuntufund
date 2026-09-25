import { BiometricLock } from '@/components/BiometricLock'
import { clearAllPublicationDrafts } from '@/lib/publicationDrafts'
import type { LegalAcceptanceInput } from '@ubuntu-fund/types'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'
import { AppState, Platform, View } from 'react-native'
import { accessToken, biometricSessionState, setSessionForeground, endSession, establishSession, expireIdleSession, hydrateSession, observeSession, recordActivity, sessionSnapshot } from '@/lib/session'
import { loginApi, logoutApi, registerApi } from '@/lib/api'
import type { AuthUser, AuthTokens } from '@/lib/api'
import { onAgreementRequired } from '@/lib/agreementEvents'
import { fetchLegalStatus, type LegalStatus } from '@/lib/agreementStatus'

interface AuthState {
  user: AuthUser | null
  tokens: AuthTokens | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  biometricLocked: boolean
  login: (email: string, password: string, mfaCode?: string) => Promise<void>
  register: (data: {
    name: string
    email: string
    password: string
    country?: string
    role?: string
    website?: string
    needsWebsite?: boolean
    organizationName?: string
    organizationType?: string
    legalAcceptance?: LegalAcceptanceInput
    registrationNumber?: string
    referralCode?: string
  }) => Promise<void>
  replaceTokens: (tokens: AuthTokens, userId: string) => Promise<void>
  logout: () => Promise<void>
  /** The API's agreement status for the signed-in user, once loaded. */
  legalStatus: LegalStatus | null
  refreshLegalStatus: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: true,
  })

  const [deviceState, setDeviceState] = useState(biometricSessionState())
  const [foreground, setForeground] = useState(AppState.currentState === 'active')

  useEffect(() => {
    setSessionForeground(AppState.currentState === 'active')
    let mounted = true
    const sync = () => {
      if (!mounted) return
      setDeviceState(biometricSessionState())
      const session = sessionSnapshot()
      setState({ user: session?.user ?? null, tokens: session?.tokens ?? null, isAuthenticated: !!session, isLoading: false })
    }
    const unsubscribe = observeSession(sync)
    void hydrateSession().then(async () => { sync(); try { await accessToken() } catch { /* Offline sessions are retained. */ } }).catch(sync)
    const tick = () => { if (!expireIdleSession() && AppState.currentState === 'active') void accessToken().catch(() => {}) }
    const timer = setInterval(tick, 30000)
    const appState = AppState.addEventListener('change', value => { const active = value === 'active'; setForeground(active); setSessionForeground(active, value === 'background'); if (active) tick() })
    const blur = Platform.OS === 'android' ? AppState.addEventListener('blur', () => { setForeground(false); setSessionForeground(false) }) : null
    const focus = Platform.OS === 'android' ? AppState.addEventListener('focus', () => { setForeground(true); setSessionForeground(true); tick() }) : null
    return () => { mounted = false; unsubscribe(); clearInterval(timer); appState.remove(); blur?.remove(); focus?.remove() }
  }, [])

  const login = useCallback(async (email: string, password: string, mfaCode?: string) => {
    const { user, tokens } = await loginApi(email, password, mfaCode)
    await establishSession(user, tokens)

  }, [])

  const register = useCallback(async (data: {
    name: string
    email: string
    password: string
    country?: string
    role?: string
    website?: string
    needsWebsite?: boolean
    organizationName?: string
    organizationType?: string
    legalAcceptance?: LegalAcceptanceInput
    registrationNumber?: string
    referralCode?: string
  }) => {
    const { user, tokens } = await registerApi(data)
    await establishSession(user, tokens)

  }, [])

  // Re-read the agreement status on sign-in, when the app returns to the
  // foreground and after any 428: the bundled version can lag the API's.
  const [fetchedLegalStatus, setLegalStatus] = useState<(LegalStatus & { userId: string }) | null>(null)
  const signedInUserId = state.isAuthenticated ? state.user?.id : undefined
  const legalStatus = signedInUserId && fetchedLegalStatus?.userId === signedInUserId ? fetchedLegalStatus : null
  const refreshLegalStatus = useCallback(async () => {
    const userId = sessionSnapshot()?.user.id
    if (!userId) return
    const status = await fetchLegalStatus()
    if (status && sessionSnapshot()?.user.id === userId) setLegalStatus({ ...status, userId })
  }, [])
  useEffect(() => {
    if (!signedInUserId) return
    let active = true, last = Date.now()
    const load = () => {
      last = Date.now()
      fetchLegalStatus().then(status => {
        if (active && status && sessionSnapshot()?.user.id === signedInUserId) setLegalStatus({ ...status, userId: signedInUserId })
      }).catch(() => { /* Keep the cached view; the next foreground retries. */ })
    }
    load()
    const appState = AppState.addEventListener('change', value => {
      if (value === 'active' && Date.now() - last >= 60_000) load()
    })
    const unsubscribe = onAgreementRequired(load)
    return () => { active = false; appState.remove(); unsubscribe() }
  }, [signedInUserId])

  const replaceTokens = useCallback(async (tokens: AuthTokens, userId: string) => {
    const current = sessionSnapshot()
    if (current?.user.id === userId) await establishSession(current.user, tokens)
  }, [])

  const logout = useCallback(async () => {
    // Best-effort server-side sign-out so a copied refresh token stops working;
    // never delay or block the local sign-out on the network.
    const refreshToken = sessionSnapshot()?.tokens.refreshToken
    if (refreshToken) void logoutApi(refreshToken).catch(() => {})
    await endSession()
    await clearAllPublicationDrafts()
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, biometricLocked: deviceState.locked, login, register, replaceTokens, logout, legalStatus, refreshLegalStatus }}>
      <View style={{ flex: 1 }} onTouchStart={recordActivity}>
        <View style={{ flex: 1, display: deviceState.locked || (deviceState.enabled && !foreground) ? 'none' : 'flex' }} accessibilityElementsHidden={deviceState.locked || (deviceState.enabled && !foreground)} importantForAccessibility={deviceState.locked || (deviceState.enabled && !foreground) ? 'no-hide-descendants' : 'auto'}>{children}</View>
        {(deviceState.locked || (deviceState.enabled && !foreground)) && <BiometricLock suspended={!foreground} />}
      </View>
    </AuthContext.Provider>
  )
}

/** Keep the navigator alive so unlocking cannot replay a stale launch deep link. */
export function BiometricScreen({ children }: { children: ReactNode }) {
  const { biometricLocked } = useAuth()
  return biometricLocked ? null : children
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
