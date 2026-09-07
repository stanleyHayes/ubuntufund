/**
 * Split-proceeds multi-beneficiary (spec §17 split / ADR-3).
 *
 * A campaign may share its cleared net across several beneficiaries by
 * percentage. Allocations are held in **basis points** (1 bp = 1/100 of a
 * percent) as integers — never floats — and always total {@link SPLIT_TOTAL_BPS}
 * (10000 = 100%). A split is captured as an **immutable version**: amendments
 * fork a new version applied only prospectively, so historical accruals stay
 * anchored to the split that was in force when the money arrived.
 */

import type { PayoutProvider, PayoutRecipientType, PayoutStatus } from './payout'

/** Basis points that a full (100%) allocation must sum to. */
export const SPLIT_TOTAL_BPS = 10000

/**
 * Lifecycle of a split version:
 *  - draft:      being configured / collecting beneficiary consent; not in force
 *  - active:     the split currently governing accruals (at most one per campaign)
 *  - superseded: a prior version replaced by a newer active one (kept for history)
 */
export type SplitStatus = 'draft' | 'active' | 'superseded'

/** A beneficiary's consent to their allocation on a specific version. */
export type BeneficiaryConsentStatus = 'pending' | 'accepted' | 'declined'

/** One beneficiary's share of a split version. */
export interface BeneficiaryAllocation {
  /** Stable id for the beneficiary within the campaign (provided, or generated). */
  beneficiaryId: string
  /** Display name shown in donor-facing disclosure. */
  name: string
  /** Optional contact used to request consent. */
  email?: string
  /** Allocation share in basis points; the allocations sum to SPLIT_TOTAL_BPS. */
  shareBps: number
  /** This beneficiary's consent to this version's allocation. */
  consent: BeneficiaryConsentStatus
  consentAt?: Date
}

/**
 * An immutable snapshot of a campaign's beneficiary split. A campaign can have
 * many versions over time; exactly one is `active`. A version `locked`s the
 * moment the first contribution accrues against it — thereafter it is read-only
 * and any change must fork a new version.
 */
export interface CampaignSplitVersion {
  id: string
  campaignId: string
  /** Monotonic version number (1-based); an amendment creates version n+1. */
  version: number
  status: SplitStatus
  allocations: BeneficiaryAllocation[]
  /** Set once the first successful contribution accrues; edits then must amend. */
  locked: boolean
  lockedAt?: Date
  /** The user (campaign owner or admin) who created this version. */
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

/** Owner input for one allocation when creating/amending a split. */
export interface CreateSplitAllocationInput {
  /** Optional stable id; generated when omitted. */
  beneficiaryId?: string
  name: string
  email?: string
  shareBps: number
}

/** Owner input to create (or amend) a campaign's split. */
export interface CreateSplitInput {
  allocations: CreateSplitAllocationInput[]
}

/**
 * Donor-facing disclosure of the active split: who receives the proceeds and in
 * what proportion. Exposes names + shares only — no beneficiary contact detail.
 */
export interface CampaignSplitDisclosure {
  campaignId: string
  version: number
  locked: boolean
  beneficiaries: {
    name: string
    shareBps: number
    /** Convenience percentage (shareBps / 100), e.g. 2500 bps → 25. */
    sharePercent: number
    consent: BeneficiaryConsentStatus
  }[]
}

/**
 * A per-`(campaign, beneficiary)` balance read model (spec §17 / ADR-3). Mirrors
 * the campaign-level buckets so a beneficiary's cleared share can be paid out
 * independently. Amounts are in major units (GHS).
 */
export interface CampaignBeneficiaryBalance {
  campaignId: string
  beneficiaryId: string
  currency: string
  /** Accrued from settled donations, not yet cleared for payout. */
  pendingBalance: number
  /** Cleared and available for the beneficiary to withdraw. */
  availableBalance: number
  /** Already disbursed to the beneficiary. */
  paidOutBalance: number
  updatedAt: Date
}

/**
 * The immutable record of how one settled donation's beneficiary-net was split
 * across beneficiaries — the source of truth for reversing a refund by the
 * exact amounts credited (never a re-derivation that a later amendment could
 * skew). Keyed by the donation intent, so it is written exactly once.
 */
export interface CampaignBeneficiaryAccrual {
  campaignId: string
  donationIntentId: string
  splitVersion: number
  currency: string
  entries: { beneficiaryId: string; amount: number }[]
  /** Cumulative amount already reversed (in minor units/pesewas), so successive
   *  partial refunds can never reverse more than was accrued. */
  reversedMinor: number
  /** True once the full accrual has been reversed. */
  reversed: boolean
  createdAt: Date
}

/** One line of a beneficiary's statement. */
export interface BeneficiaryStatementEntry {
  at: Date
  kind: 'accrual' | 'refund'
  amount: number
  currency: string
  donationIntentId: string
  splitVersion: number
}

/** A beneficiary's statement for a campaign: current balance + accrual history. */
export interface BeneficiaryStatement {
  campaignId: string
  beneficiaryId: string
  currency: string
  balance: CampaignBeneficiaryBalance
  entries: BeneficiaryStatementEntry[]
}

/**
 * A beneficiary's own provider-registered payout destination (spec §17 / ADR-3,
 * D5). Each beneficiary who receives a share must register a bank/mobile-money
 * account and be KYC-verified by an admin before their share can be disbursed.
 */
export interface BeneficiaryRecipient {
  id: string
  campaignId: string
  beneficiaryId: string
  type: PayoutRecipientType
  accountNumber: string
  bankCode: string
  accountName: string
  /** Opaque provider recipient handle; addresses transfers. */
  recipientCode: string
  currency: string
  /** Admin must verify the beneficiary's KYC before their payout is approvable. */
  kycVerified: boolean
  kycVerifiedBy?: string
  kycVerifiedAt?: Date
  createdBy: string
  createdAt: Date
}

/**
 * A disbursement of one beneficiary's cleared share (spec §17 / ADR-3). Its own
 * `bpay-` transfer rail, isolated from the campaign-level payout engine; every
 * money move mirrors into the campaign aggregate buckets so they never diverge.
 */
export interface BeneficiaryPayout {
  id: string
  campaignId: string
  beneficiaryId: string
  recipientId: string
  amount: number
  currency: string
  status: PayoutStatus
  provider: PayoutProvider
  providerRef?: string
  transferCode?: string
  requestedBy: string
  approvedBy?: string
  /** Maker-checker (spec §16): the first admin to approve a high-value payout. */
  firstApprovedBy?: string
  firstApprovedAt?: Date
  createdAt: Date
  updatedAt: Date
}

/** Owner/beneficiary input to register a beneficiary's payout recipient. */
export interface RegisterBeneficiaryRecipientInput {
  type: PayoutRecipientType
  accountNumber: string
  bankCode: string
  accountName: string
}

/** Beneficiary/owner input to request a payout of a beneficiary's cleared share. */
export interface RequestBeneficiaryPayoutInput {
  amount: number
}
