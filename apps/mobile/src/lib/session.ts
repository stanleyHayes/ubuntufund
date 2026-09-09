import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import type { AuthTokens, AuthUser } from './api'

export const IDLE_MS = 60 * 60 * 1000
interface Session { user: AuthUser; tokens: AuthTokens; lastActivity: number }
let current: Session | null = null
let hydrated = false
let hydration: Promise<void> | null = null
let epoch = 0
let pending: Promise<string | null> | null = null
let refresh: (token: string) => Promise<AuthTokens>
let writes: Promise<void> = Promise.resolve()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(listener => listener())
export function observeSession(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function sessionSnapshot() { return current }
export function configureRefresh(handler: typeof refresh) { refresh = handler }
function persist() {
  const snapshot = current
  writes = writes.catch(() => {}).then(async () => {
    if (snapshot) {
      await SecureStore.setItemAsync('uf_tokens', JSON.stringify(snapshot.tokens), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })
      await AsyncStorage.multiSet([['uf_user', JSON.stringify(snapshot.user)], ['uf_last_activity', String(snapshot.lastActivity)]])
    } else {
      await SecureStore.deleteItemAsync('uf_tokens')
      await AsyncStorage.multiRemove(['uf_user', 'uf_tokens', 'uf_last_activity'])
    }
  })
  return writes
}
export async function hydrateSession() {
  if (hydrated) return
  if (hydration) return hydration
  const started = epoch
  hydration = (async () => {
    const [user, secure, legacy, activity] = await Promise.all([AsyncStorage.getItem('uf_user'), SecureStore.getItemAsync('uf_tokens'), AsyncStorage.getItem('uf_tokens'), AsyncStorage.getItem('uf_last_activity')])
    if (epoch !== started) return
    let next: Session | null = null
    try {
      if (user && (secure || legacy)) {
        const tokens = JSON.parse(secure || legacy!) as AuthTokens
        const lastActivity = activity ? Number(activity) : Date.now()
        if (tokens.refreshToken && Number.isFinite(lastActivity) && Date.now() - lastActivity < IDLE_MS) next = { user: JSON.parse(user), tokens, lastActivity }
      }
    } catch { next = null }
    current = next; hydrated = true
    if (!secure && legacy && next) await persist()
    await AsyncStorage.removeItem('uf_tokens')
    if (!next) await persist()
    emit()
  })().finally(() => { hydration = null })
  return hydration
}
export async function establishSession(user: AuthUser, tokens: AuthTokens) {
  epoch++; pending = null; hydrated = true
  current = { user, tokens, lastActivity: Date.now() }
  emit(); await persist()
}
export async function endSession() {
  epoch++; pending = null; hydrated = true; current = null
  emit(); await persist()
}
export function expireIdleSession() {
  if (current && Date.now() - current.lastActivity >= IDLE_MS) { void endSession().catch(() => {}); return true }
  return false
}
let lastSavedActivity = 0
export function recordActivity() {
  if (expireIdleSession() || !current) return
  current = { ...current, lastActivity: Date.now() }
  if (Date.now() - lastSavedActivity > 5000) { lastSavedActivity = Date.now(); void persist().catch(() => {}) }
}
function nearingExpiry(token: string) {
  try { const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return !payload.exp || payload.exp * 1000 < Date.now() + 60000 }
  catch { return true }
}
export async function accessToken(forceRefresh = false): Promise<string | null> {
  await hydrateSession()
  if (expireIdleSession() || !current) return null
  if (!forceRefresh && !nearingExpiry(current.tokens.accessToken)) return current.tokens.accessToken
  if (pending) return pending
  const started = epoch
  const session = current
  const attempt = (async () => {
    try {
      const tokens = await refresh(session.tokens.refreshToken)
      if (started !== epoch || !current || expireIdleSession()) return null
      current = { ...current, tokens }; emit(); await persist()
      return tokens.accessToken
    } catch (e) {
      if (started !== epoch) return null
      const status = (e as { status?: number }).status
      if (status === 401 || status === 403) await endSession()
      // Network/server errors preserve the session but do not send an expired request.
      throw e
    }
  })()
  pending = attempt
  try { return await attempt } finally { if (pending === attempt) pending = null }
}
