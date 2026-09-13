import { BIOMETRIC_PREFERENCE, biometricCapability, clearBiometricCredential, readBiometricCredential, writeBiometricCredential } from './biometricVault'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import type { AuthTokens, AuthUser } from './api'

export const IDLE_MS = 60 * 60 * 1000
interface Session { user: AuthUser; tokens: AuthTokens; lastActivity: number }
let current: Session | null = null
let biometricUser: string | null = null
let locked = false
let foreground = true
let biometricBusy = false
let unlockAttempt: Promise<void> | null = null
export function biometricSessionState() { return { enabled: !!biometricUser, locked } }
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const result = writes.catch(() => {}).then(work)
  writes = result.then(() => {}, () => {})
  return result
}
export function setSessionForeground(active: boolean, background = false) {
  foreground = active
  if (!active && (!biometricBusy || background)) lockBiometricSession()
}
export function lockBiometricSession() {
  if (!biometricUser) return
  epoch++; pending = null; current = null; locked = true
  emit()
}
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
  const snapshot = current, started = epoch
  return serialize(async () => {
    if (started !== epoch) return
    if (snapshot) {
      // While unlocked, renewals live in memory. The protected refresh credential
      // remains bounded by its original server expiry; it is never copied here.
      if (!biometricUser) await SecureStore.setItemAsync('uf_tokens', JSON.stringify(snapshot.tokens), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })
      await AsyncStorage.multiSet([['uf_user', JSON.stringify(snapshot.user)], ['uf_last_activity', String(snapshot.lastActivity)]])
    } else if (!locked) {
      await clearBiometricCredential()
      await SecureStore.deleteItemAsync('uf_tokens')
      await AsyncStorage.multiRemove(['uf_user', 'uf_tokens', 'uf_last_activity'])
    }
  })
}
export async function hydrateSession() {
  if (hydrated) return
  if (hydration) return hydration
  const started = epoch
  hydration = (async () => {
    const protectedUser = await SecureStore.getItemAsync(BIOMETRIC_PREFERENCE)
    if (epoch !== started) return
    if (protectedUser) {
      // Check the secure preference before any ordinary/legacy credential read.
      biometricUser = protectedUser; locked = true; current = null; hydrated = true
      await serialize(async () => { await SecureStore.deleteItemAsync('uf_tokens'); await AsyncStorage.removeItem('uf_tokens') })
      emit(); return
    }
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
  const retainBiometrics = biometricUser === user.id
  epoch++; pending = null; hydrated = true; locked = false
  const started = epoch
  current = { user, tokens, lastActivity: Date.now() }
  if (!retainBiometrics) biometricUser = null
  emit()
  if (retainBiometrics) {
    biometricBusy = true
    try {
      await serialize(async () => {
        if (started !== epoch) return
        await writeBiometricCredential(user.id, tokens.refreshToken, false)
      })
    } finally { biometricBusy = false; if (!foreground) lockBiometricSession() }
  } else await serialize(clearBiometricCredential)
  await persist()
}
export async function enableBiometricSession() {
  if (!current || locked) throw new Error('Sign in before enabling biometric unlock.')
  if (biometricBusy) throw new Error('Finish the current biometric request first.')
  const session = current, started = epoch
  biometricBusy = true
  try {
    if (!(await biometricCapability()).available) throw new Error('Supported biometrics are not enrolled on this device.')
    await serialize(async () => {
      if (started !== epoch || current?.user.id !== session.user.id) throw new Error('Your session changed. Try again.')
      try {
        await writeBiometricCredential(session.user.id, session.tokens.refreshToken, true)
        if (started !== epoch) throw new Error('Your session changed. Try again.')
        await SecureStore.setItemAsync(BIOMETRIC_PREFERENCE, session.user.id, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })
        await SecureStore.deleteItemAsync('uf_tokens')
        await AsyncStorage.removeItem('uf_tokens')
        if (started !== epoch) throw new Error('Your session changed. Try again.')
        biometricUser = session.user.id; emit()
      } catch (error) { await clearBiometricCredential(); throw error }
    })
  } finally { biometricBusy = false; if (!foreground) lockBiometricSession() }
}
export async function disableBiometricSession() {
  if (!current || locked || biometricBusy) throw new Error('Unlock your account before changing biometric protection.')
  const session = current, started = epoch
  biometricBusy = true
  try {
    await serialize(async () => {
      const saved = await readBiometricCredential()
      if (started !== epoch || saved.userId !== session.user.id) throw new Error('Your session changed. Try again.')
      // Write the ordinary secure credential before removing the protected vault.
      await SecureStore.setItemAsync('uf_tokens', JSON.stringify(session.tokens), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })
      try { await clearBiometricCredential() } catch (error) { await SecureStore.deleteItemAsync('uf_tokens'); throw error }
      if (started === epoch) { biometricUser = null; emit() }
    })
  } finally { biometricBusy = false; if (!foreground) lockBiometricSession() }
}
export async function unlockBiometricSession() {
  if (unlockAttempt) return unlockAttempt
  if (!locked || !biometricUser || biometricBusy) return
  const started = epoch, userId = biometricUser
  biometricBusy = true
  const attempt = (async () => {
    // Wait for any preceding credential write before opening the protected item.
    await writes
    const saved = await readBiometricCredential()
    if (started !== epoch || saved.userId !== userId) return
    const raw = await AsyncStorage.getItem('uf_user')
    const user = raw ? JSON.parse(raw) as AuthUser : null
    if (!user || user.id !== userId) throw new Error('Saved account information is unavailable. Sign in with your password.')
    let timeout: ReturnType<typeof setTimeout> | undefined
    let tokens: AuthTokens
    try {
      tokens = await Promise.race([refresh(saved.refreshToken), new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(new Error('Unlock could not reach Ujimora. Try again or use password sign-in.')), 15_000) })])
    } finally { if (timeout) clearTimeout(timeout) }
    if (started !== epoch || !foreground) return
    epoch++; pending = null; locked = false; current = { user, tokens, lastActivity: Date.now() }; emit()
    await persist()
  })()
  unlockAttempt = attempt
  try { await attempt } finally { if (unlockAttempt === attempt) unlockAttempt = null; biometricBusy = false; if (!foreground) lockBiometricSession() }
}
export async function endSession() {
  epoch++; pending = null; hydrated = true; current = null; biometricUser = null; locked = false
  emit(); await persist()
}
export function expireIdleSession() {
  if (current && Date.now() - current.lastActivity >= IDLE_MS) {
    if (biometricUser) lockBiometricSession()
    else void endSession().catch(() => {})
    return true
  }
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
      return started === epoch && current && !locked ? tokens.accessToken : null
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
