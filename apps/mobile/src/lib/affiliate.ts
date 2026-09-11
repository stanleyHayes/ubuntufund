import { api, ApiError } from './api'
import type {
  Affiliate,
  AffiliateCommission,
  AffiliateDashboard,
  AffiliateReferral,
} from '@ubuntu-fund/types'

// ---------------------------------------------------------------------------
// Affiliate program (mobile) — mirrors apps/web/src/lib/affiliate.ts against the
// live /affiliate/* endpoints. GET /affiliate 404s until the user enrolls, so
// getAffiliateDashboard() resolves to null in that case (a "join" CTA state)
// rather than throwing.
// ---------------------------------------------------------------------------

export async function getAffiliateDashboard(): Promise<AffiliateDashboard | null> {
  try {
    return await api.get<AffiliateDashboard>('/affiliate')
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export async function enrollAffiliate(): Promise<Affiliate> {
  return api.post<Affiliate>('/affiliate/enroll')
}

/**
 * Replace the auto-generated referral code with a chosen one.
 *
 * Retires the previous code: links already shared under it stop attributing.
 * Commission already earned is keyed by affiliate id, so it is unaffected.
 */
export async function updateAffiliateReferralCode(referralCode: string): Promise<Affiliate> {
  return api.put<Affiliate>('/affiliate/referral-code', { referralCode })
}

export async function listAffiliateReferrals(): Promise<AffiliateReferral[]> {
  return api.get<AffiliateReferral[]>('/affiliate/referrals')
}

export async function listAffiliateCommissions(): Promise<AffiliateCommission[]> {
  return api.get<AffiliateCommission[]>('/affiliate/commissions')
}

export async function requestAffiliatePayout(amount: number): Promise<void> {
  await api.post('/affiliate/payouts', { amount })
}
