import type { CryptoDonationStatus } from '@ubuntu-fund/types'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto'
import { api } from './api'
import { sessionSnapshot } from './session'

export interface PendingPayment { id: string; status: string; reference?: string; authorizationUrl?: string; storageKey: string }
export function paymentScope(kind: string, target: string) { return `ujimora:${sessionSnapshot()?.user.id || 'guest'}:${kind}:${target}` }
const keyRequests = new Map<string, Promise<string>>()
export async function paymentKey(scope: string, input: unknown) {
  const serialized = JSON.stringify(input)
  const key = `${scope}:request-sha256:${await digestStringAsync(CryptoDigestAlgorithm.SHA256, serialized)}`
  const legacyKey = `${scope}:request:${serialized}`
  const existing = keyRequests.get(key)
  if (existing) return existing
  const operation = (async () => {
    let value = await AsyncStorage.getItem(key)
    const legacyValue = await AsyncStorage.getItem(legacyKey)
    if ((value !== null && !value.trim()) || (legacyValue !== null && !legacyValue.trim())) {
      throw new Error('A saved payment attempt could not be read. Check your payment history or contact support before trying again. The saved records have been preserved.')
    }
    if (value && legacyValue && value !== legacyValue) {
      throw new Error('Two saved attempts were found for this payment. Check your payment history or contact support before trying again. Both attempts have been preserved.')
    }
    if (!value) {
      // Keep the original attempt identity across upgrades and ambiguous results.
      // Remove the plaintext input only after its replacement is durable.
      value = legacyValue || randomUUID()
      await AsyncStorage.setItem(key, value)
    }
    await AsyncStorage.multiRemove([legacyKey])
    return value
  })()
  keyRequests.set(key, operation)
  try { return await operation } finally { keyRequests.delete(key) }
}
export async function savePending(scope: string, payment: PendingPayment) { await AsyncStorage.setItem(`${scope}:pending`, JSON.stringify(payment)) }
export async function loadPending(scope: string): Promise<PendingPayment | null> {
  const value = await AsyncStorage.getItem(`${scope}:pending`)
  if (value === null) return null
  try {
    const payment: unknown = JSON.parse(value)
    if (!payment || typeof payment !== 'object' || Array.isArray(payment)) throw new Error('Invalid payment')
    const record = payment as Record<string, unknown>
    if (typeof record.id !== 'string' || !record.id.trim() || typeof record.status !== 'string' || !record.status.trim() || record.storageKey !== scope ||
      (record.reference !== undefined && typeof record.reference !== 'string') ||
      (record.authorizationUrl !== undefined && typeof record.authorizationUrl !== 'string')) throw new Error('Invalid payment')
    return record as unknown as PendingPayment
  } catch {
    throw new Error('Your saved payment could not be read. Check your payment history or contact support before trying another payment. The saved attempt has been preserved.')
  }
}
export async function clearPending(scope: string) {
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(`${scope}:`))
  await AsyncStorage.multiRemove(keys)
}
export function isPaymentSuccess(status: string) { return ['SUCCEEDED', 'CONFIRMED', 'completed'].includes(status) }
export function isPaymentTerminal(status: string) { return isPaymentSuccess(status) || ['FAILED', 'EXPIRED', 'CANCELLED', 'failed', 'expired'].includes(status) }
export async function checkout(scope: string, path: string, input: unknown, topup = false): Promise<PendingPayment> {
  // Validate recovery state before creating or sending any payment attempt.
  await loadPending(scope)
  const key = await paymentKey(scope, input)
  const response = await api.post<Record<string, unknown>>(path, input, { 'Idempotency-Key': key })
  const intent = (response.intent || response) as { id: string; status: string }
  const payment: PendingPayment = { id: topup ? String(response.reference) : intent.id, status: intent.status, reference: response.reference as string | undefined, authorizationUrl: (response.authorizationUrl || response.authorization_url) as string | undefined, storageKey: scope }
  if (!payment.id || payment.id === 'undefined') throw new Error('Payment reference was not returned. Retry to recover the same request.')
  await savePending(scope, payment)
  return payment
}

export function cryptoStatusFromIntent(status: string): CryptoDonationStatus | undefined {
  const states: Record<string, CryptoDonationStatus> = { PENDING: 'AWAITING_PAYMENT', PROCESSING: 'PENDING_CONFIRMATION', SUCCEEDED: 'CONFIRMED', CANCELLED: 'FAILED', FAILED: 'FAILED', EXPIRED: 'EXPIRED', AWAITING_PAYMENT: 'AWAITING_PAYMENT', PENDING_CONFIRMATION: 'PENDING_CONFIRMATION', CONFIRMED: 'CONFIRMED' }
  return states[status]
}
