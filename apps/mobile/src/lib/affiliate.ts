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

/** A saved payout account as GET /payout-accounts lists it. */
export interface SavedPayoutAccountSummary {
  id: string
  accountName: string
  last4: string
  bankCode: string
  verificationStatus: string
}

/**
 * Affiliate payouts can only go to a saved account whose provider-held name
 * matched; the rest are shown but cannot be chosen.
 */
export function affiliateDestinationChoices(accounts: SavedPayoutAccountSummary[]) {
  return {
    selectable: accounts.filter((a) => a.verificationStatus === 'name_matched'),
    blocked: accounts.filter((a) => a.verificationStatus !== 'name_matched'),
  }
}

export async function listSavedPayoutAccounts(): Promise<SavedPayoutAccountSummary[]> {
  return (await api.get<{ accounts: SavedPayoutAccountSummary[] }>('/payout-accounts')).accounts
}

/** Choose where affiliate payouts go (`POST /affiliate/payout-recipient`). */
export async function setAffiliatePayoutRecipient(savedAccountId: string): Promise<Affiliate> {
  return api.post<Affiliate>('/affiliate/payout-recipient', { savedAccountId })
}
