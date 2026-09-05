// ---------------------------------------------------------------------------
// Affiliate client — typed wrapper over the owner-facing affiliate/referral
// program endpoints (POST /affiliate/enroll, GET /affiliate, …). Built on the
// shared `api` client (auth-aware, unwraps the `{ data }` envelope).
//
// The dashboard GET is the one call that has to tell "not enrolled" (the API
// answers 404) apart from a real failure, so it drops to the lower-level
// `request` helper — which surfaces the HTTP status as `ApiError` — and returns
// `null` for the not-enrolled case so the UI can show an enroll CTA.
// ---------------------------------------------------------------------------

import { api, request, ApiError } from './api'
import type {
  Affiliate,
  AffiliateDashboard,
  AffiliateReferral,
  AffiliateCommission,
  AffiliatePayout,
  SetAffiliatePayoutRecipientInput,
} from '@ubuntu-fund/types'

// --- Re-exported contract types (import from this module in the UI) ---------
export type {
  Affiliate,
  AffiliateDashboard,
  AffiliateBalance,
  AffiliateStats,
  AffiliateReferral,
  AffiliateReferralStatus,
  AffiliateCommission,
  AffiliateCommissionStatus,
  AffiliatePayout,
  SetAffiliatePayoutRecipientInput,
} from '@ubuntu-fund/types'

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
// Owner-facing affiliate API
// ---------------------------------------------------------------------------

/**
 * Enroll the current user in the affiliate program
 * (`POST /affiliate/enroll`). Idempotent server-side — a user who is already
 * enrolled simply gets their existing record back.
 */
export function enroll(): Promise<Affiliate> {
  return api.post<Affiliate>('/affiliate/enroll')
}

/**
 * The current user's affiliate dashboard (`GET /affiliate`): profile, balance,
 * shareable referral link and referral stats. Resolves to `null` when the user
 * is not enrolled (the API answers 404) so callers can show an enroll CTA;
 * any other failure propagates as an `ApiError`.
 */
export async function getAffiliateDashboard(): Promise<AffiliateDashboard | null> {
  try {
    const envelope = await request<{ data: AffiliateDashboard }>('/affiliate', {
      token: getStoredToken(),
    })
    return envelope.data
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/** The current user's referred signups (`GET /affiliate/referrals`). */
export function listReferrals(): Promise<AffiliateReferral[]> {
  return api.get<AffiliateReferral[]>('/affiliate/referrals')
}

/** The current user's commission ledger (`GET /affiliate/commissions`). */
export function listCommissions(): Promise<AffiliateCommission[]> {
  return api.get<AffiliateCommission[]>('/affiliate/commissions')
}

/**
 * Register a payout destination (`POST /affiliate/payout-recipient`) — a GhIPSS
 * bank account or mobile-money wallet the affiliate's commission is paid to.
 */
export function setPayoutRecipient(
  input: SetAffiliatePayoutRecipientInput,
): Promise<Affiliate> {
  return api.post<Affiliate>('/affiliate/payout-recipient', input)
}

/** Request a payout of available commission (`POST /affiliate/payouts`). */
export function requestPayout(amount: number): Promise<AffiliatePayout> {
  return api.post<AffiliatePayout>('/affiliate/payouts', { amount })
}
