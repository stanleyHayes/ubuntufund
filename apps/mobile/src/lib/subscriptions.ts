import { api } from './api'
import type {
  CreateSubscriptionCheckoutInput,
  SubscriptionCheckout,
  SubscriptionCheckoutResult,
} from '@ubuntu-fund/types'

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
  return api.post<SubscriptionCheckoutResult>('/subscriptions/checkout', input)
}

export async function getSubscriptionCheckoutStatus(
  id: string,
): Promise<SubscriptionCheckout> {
  return api.get<SubscriptionCheckout>(`/subscriptions/checkout/${id}`)
}
