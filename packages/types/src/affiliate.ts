import type { PayoutStatus, PayoutProvider, PayoutRecipientType } from './payout'

// Affiliate/referral program. A user enrolls to get a referral code; a referred
// signup is linked at registration and CONVERTS on the referee's FIRST paid
// subscription (one-time commission). A commission accrues in a HELD state,
// matures to AVAILABLE after a hold window, then can be paid out via Paystack
// Transfers — and is REVERSED if the referred subscription is later refunded.

export enum AffiliateStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

/** A referred signup's lifecycle: linked at register, converted on first paid subscription. */
export type AffiliateReferralStatus = 'pending' | 'converted'

/**
 * Commission ledger states (rich-entity transitions, like Payout):
 *  held      — earned, inside the clawback hold window (counts as pendingBalance)
 *  available — hold elapsed, withdrawable (counts as availableBalance)
 *  paid      — disbursed via an affiliate payout
 *  reversed  — clawed back after a refund/chargeback of the referred subscription
 *  cancelled — voided administratively
 */
export type AffiliateCommissionStatus = 'held' | 'available' | 'paid' | 'reversed' | 'cancelled'

export type AffiliateCommissionSource = 'subscription'

/** One affiliate record per user (unique userId). Holds the user's own code + payout recipient. */
export interface Affiliate {
  id: string
  userId: string
  referralCode: string
  status: AffiliateStatus
  /** Commission % of net paid-subscription revenue; overrides the platform default. */
  commissionRate: number
  // Paystack payout destination (set via SetAffiliatePayoutRecipientUseCase; optional until set)
  recipientCode?: string
  recipientType?: PayoutRecipientType
  accountNumber?: string
  bankCode?: string
  accountName?: string
  createdAt: Date
  updatedAt: Date
}

/** Referrer → referee link captured at registration. A user is referred at most once (unique refereeId). */
export interface AffiliateReferral {
  id: string
  /** The referrer's Affiliate.id (resolved from the referral code at signup). */
  referrerId: string
  /** The newly-registered user's id. Unique. */
  refereeId: string
  referralCode: string
  status: AffiliateReferralStatus
  convertedAt?: Date
  createdAt: Date
  updatedAt: Date
}

/** A commission earned when a referred user's FIRST subscription payment settles. */
export interface AffiliateCommission {
  id: string
  affiliateId: string
  refereeId: string
  source: AffiliateCommissionSource
  /** The subscription charge providerRef this was earned on — unique+sparse (webhook idempotency). */
  sourceRef: string
  /** Commission in major GHS units. */
  amount: number
  currency: string
  /** The post-coupon charged subscription amount the commission was computed from. */
  baseAmount: number
  commissionRate: number
  status: AffiliateCommissionStatus
  /** When a HELD commission becomes AVAILABLE (end of the clawback hold window). */
  maturesAt: Date
  createdAt: Date
  updatedAt: Date
}

/** Per-affiliate commission balance read model (mirrors CampaignBalance buckets). */
export interface AffiliateBalance {
  id: string
  affiliateId: string
  currency: string
  totalEarned: number
  pendingBalance: number // held, not yet matured
  availableBalance: number // matured, withdrawable
  paidOutBalance: number
  updatedAt: Date
}

/** A disbursement of accrued commission via Paystack Transfers (reuses the Payout status machine). */
export interface AffiliatePayout {
  id: string
  affiliateId: string
  amount: number
  currency: string
  status: PayoutStatus
  provider: PayoutProvider
  /** `aff-<id>-<uuid8>`, unique+sparse; the transfer webhook correlates on it. */
  providerRef?: string
  transferCode?: string
  requestedBy: string
  approvedBy?: string
  createdAt: Date
  updatedAt: Date
}

// ── Inputs ────────────────────────────────────────────────────────────────
export interface SetAffiliatePayoutRecipientInput {
  type: PayoutRecipientType
  accountNumber: string
  bankCode: string
  accountName: string
}
export interface RequestAffiliatePayoutInput {
  amount: number
}
export interface SetAffiliateCommissionRateInput {
  commissionRate: number
}
export interface UpdateAffiliateStatusInput {
  status: AffiliateStatus
}

// ── Aggregate DTOs ──────────────────────────────────────────────────────────
export interface AffiliateStats {
  totalReferrals: number
  convertedReferrals: number
  pendingReferrals: number
  totalEarned: number
  availableBalance: number
  pendingBalance: number
  paidOutBalance: number
}
export interface AffiliateDashboard {
  affiliate: Affiliate
  balance: AffiliateBalance
  referralLink: string
  stats: AffiliateStats
}
