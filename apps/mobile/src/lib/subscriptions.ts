import AsyncStorage from '@react-native-async-storage/async-storage'
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

export async function recoverPendingSubscription(): Promise<void> {
  const id = await AsyncStorage.getItem(`ujimora:subscription:${sessionSnapshot()?.user.id}`)
  if (id) await getSubscriptionCheckoutStatus(id)
}
