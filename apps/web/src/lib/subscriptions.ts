// ---------------------------------------------------------------------------
// Subscriptions client — typed wrapper over the paid-subscription checkout rail
// (POST /subscriptions/checkout + GET /subscriptions/checkout/:id).
//
// Mirrors `fundraising.ts`: built on the existing `api` client (auth-aware,
// unwraps the `{ data }` envelope) but reaches for the lower-level `request`
// helper where it needs the `ApiError` status — specifically to detect the
// `501` the checkout returns when the Paystack billing rail isn't configured.
//
// The checkout Paystack reference is minted server-side as `sub-<8hex>` and
// does NOT embed the checkout id (unlike donation intents' `uf-<id>-<hex>`),
// so the callback page recovers the checkout id from the handoff store written
// here before redirect — see `saveSubscriptionCheckoutHandoff`.
// ---------------------------------------------------------------------------

import { api, request, ApiError } from './api'
import { PaymentsNotConfiguredError, isPaymentsNotConfigured } from './fundraising'
import type {
  CreateSubscriptionCheckoutInput,
  SubscriptionCheckout,
  SubscriptionCheckoutResult,
  SubscriptionTier,
  BillingCycle,
} from '@ubuntu-fund/types'

// --- Re-exported contract types (import from this module in the UI) ---------
export type {
  CreateSubscriptionCheckoutInput,
  SubscriptionCheckout,
  SubscriptionCheckoutResult,
} from '@ubuntu-fund/types'
export { SubscriptionCheckoutStatus } from '@ubuntu-fund/types'

// Reuse the single `PaymentsNotConfiguredError` class so `instanceof` and the
// narrowing helper behave identically whether the 501 surfaces from a donation
// intent or a subscription checkout.
export { PaymentsNotConfiguredError, isPaymentsNotConfigured }

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Read the stored access token (mirrors the resolution used by `api`). */
function getStoredToken(): string | undefined {
  const direct = localStorage.getItem('accessToken')
  if (direct) return direct
  try {
    const tokens = JSON.parse(localStorage.getItem('uf_tokens') ?? 'null')
    return tokens?.accessToken ?? undefined
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

/**
 * Open a paid-subscription checkout (`POST /subscriptions/checkout`, auth).
 *
 * Two outcomes are normal:
 *  - A charge is required → the result carries `authorizationUrl`; the caller
 *    redirects the browser there (`window.location.assign(authorizationUrl)`).
 *  - A coupon zeroed the price → the result carries `activatedWithoutCharge:
 *    true` with the already-activated `checkout`; no redirect, go straight to
 *    the success / dashboard state.
 *
 * @throws {PaymentsNotConfiguredError} when the Paystack rail is disabled (501).
 */
export async function createSubscriptionCheckout(
  input: CreateSubscriptionCheckoutInput,
): Promise<SubscriptionCheckoutResult> {
  try {
    const envelope = await request<{ data: SubscriptionCheckoutResult }>(
      '/subscriptions/checkout',
      {
        method: 'POST',
        body: JSON.stringify(input),
        token: getStoredToken(),
      },
    )
    return envelope.data
  } catch (err) {
    if (err instanceof ApiError && err.status === 501) {
      throw new PaymentsNotConfiguredError(err.message)
    }
    throw err
  }
}

/**
 * Poll a checkout's status (`GET /subscriptions/checkout/:id`, owner). After a
 * Paystack redirect, never treat the return as success — poll this until the
 * status settles to `SUCCEEDED` / `FAILED` / `EXPIRED`.
 */
export function getSubscriptionCheckoutStatus(id: string): Promise<SubscriptionCheckout> {
  return api.get<SubscriptionCheckout>(`/subscriptions/checkout/${encodeURIComponent(id)}`)
}

// ---------------------------------------------------------------------------
// Callback handoff store
//
// The subscription callback path is a fixed `/subscription/callback` and the
// Paystack reference (`sub-<8hex>`) carries no checkout id, so the checkout id
// is stashed here (keyed by reference, with a `__last` fallback) right before
// the redirect and recovered by `SubscriptionCallbackPage` on return.
// ---------------------------------------------------------------------------

const HANDOFF_KEY = 'uf_pending_subscriptions'

export interface PendingSubscription {
  checkoutId: string
  reference?: string
  tier: SubscriptionTier
  billingCycle: BillingCycle
  finalAmount: number
  currency: string
}

/** Persist the pending checkout before redirecting to Paystack. */
export function saveSubscriptionCheckoutHandoff(pending: PendingSubscription): void {
  try {
    const raw = localStorage.getItem(HANDOFF_KEY)
    const store: Record<string, PendingSubscription> = raw ? JSON.parse(raw) : {}
    if (pending.reference) store[pending.reference] = pending
    store.__last = pending
    localStorage.setItem(HANDOFF_KEY, JSON.stringify(store))
  } catch {
    // Storage unavailable (private mode, quota) — the callback falls back to an
    // explicit `?checkout=` id or a "still confirming" state, so ignore.
  }
}

/** Recover the pending checkout on return, by reference then `__last`. */
export function readSubscriptionHandoff(reference: string | null): PendingSubscription | null {
  try {
    const raw = localStorage.getItem(HANDOFF_KEY)
    if (!raw) return null
    const store: Record<string, PendingSubscription> = JSON.parse(raw)
    if (reference && store[reference]) return store[reference]
    return store.__last ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// URL / path helpers
// ---------------------------------------------------------------------------

/** In-app path to the subscription/plans page. */
export function subscriptionPath(): string {
  return '/subscription'
}

/** In-app path to the user dashboard. */
export function dashboardPath(): string {
  return '/dashboard'
}
