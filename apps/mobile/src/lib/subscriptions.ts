import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { sessionSnapshot } from './session'
import { api, ApiError } from './api'
import type {
  CreateSubscriptionCheckoutInput,
  SubscriptionCheckout,
  SubscriptionCheckoutResult,
} from '@ubuntu-fund/types'

/**
 * True when the API reports the Paystack rail is not configured (501) — i.e. no
 * `PAYSTACK_SECRET_KEY`. Lets the UI show a reassuring "not charged" message
 * instead of a raw error, mirroring the web client's PaymentsNotConfiguredError.
 */
export function isPaymentsNotConfigured(error: unknown): boolean {
  return error instanceof ApiError && error.status === 501
}

// ---------------------------------------------------------------------------
// Subscription checkout (mobile)
//
// Mirrors the web flow: POST /subscriptions/checkout returns either a Paystack
// `authorizationUrl` (open it in an in-app browser) or `activatedWithoutCharge`
// (a 100%-off coupon activated the plan with no charge). The real activation for
// a paid checkout lands via the signed Paystack webhook, so the client confirms
// by polling GET /subscriptions/checkout/:id — never by trusting the browser.
// ---------------------------------------------------------------------------

export async function createSubscriptionCheckout(
  input: CreateSubscriptionCheckoutInput,
): Promise<SubscriptionCheckoutResult> {
  if (Platform.OS !== 'web') throw new Error('Use App Store or Google Play billing for native subscriptions.')
  const result = await api.post<SubscriptionCheckoutResult>('/subscriptions/checkout', input)
  if (!result.activatedWithoutCharge) await AsyncStorage.setItem(`ujimora:subscription:${sessionSnapshot()?.user.id}`, result.checkout.id)
  return result
}

export async function getSubscriptionCheckoutStatus(
  id: string,
): Promise<SubscriptionCheckout> {
  const result = await api.post<SubscriptionCheckout>(`/subscriptions/checkout/${encodeURIComponent(id)}/verify`)
  if (result.status !== 'pending') await AsyncStorage.removeItem(`ujimora:subscription:${sessionSnapshot()?.user.id}`)
  return result
}

/**
 * Cancel the member's own unpaid checkout so they can start over
 * (`POST /subscriptions/checkout/:id/abandon`). The API checks with Paystack
 * first: a payment that went through comes back `succeeded`, and one still
 * being processed is refused (409) rather than risk a double charge.
 */
export async function abandonSubscriptionCheckout(id: string): Promise<SubscriptionCheckout> {
  const result = await api.post<SubscriptionCheckout>(`/subscriptions/checkout/${encodeURIComponent(id)}/abandon`)
  const key = `ujimora:subscription:${sessionSnapshot()?.user.id}`
  if (await AsyncStorage.getItem(key) === id) await AsyncStorage.removeItem(key)
  return result
}

/**
 * The open checkout blocking a new purchase, when the API refused one because
 * an earlier plan payment is still payable (409 `checkout_in_progress`).
 */
export function checkoutInProgressId(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null
  if (!error.errors?.code?.includes('checkout_in_progress')) return null
  return error.errors.checkoutId?.[0] ?? null
}

export async function recoverPendingSubscription(): Promise<void> {
  const id = await AsyncStorage.getItem(`ujimora:subscription:${sessionSnapshot()?.user.id}`)
  if (id) await getSubscriptionCheckoutStatus(id)
}
