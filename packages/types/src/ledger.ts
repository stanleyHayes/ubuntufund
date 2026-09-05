/**
 * Immutable, append-only double-entry ledger.
 *
 * Every settled donation posts one balanced {@link JournalEntry}: the sum of
 * its `debit` lines always equals the sum of its `credit` lines. Posted
 * entries are never mutated or deleted — a correction is a *new* reversing
 * entry. Campaign totals and beneficiary balances are PROJECTED from posted
 * ledger activity (see {@link CampaignBalance}); they are never the source of
 * truth themselves.
 */

/**
 * The chart-of-accounts buckets a donation splits across.
 * - `campaign`      — the gross donation directed at a campaign (raised total)
 * - `beneficiary`   — the net owed to the campaign's beneficiary after fees
 * - `platform_fee`  — the platform's revenue cut + any donor tip
 * - `processor_fee` — the payment processor's fee (e.g. Paystack)
 * - `tip`           — the donor's optional tip inflow to the platform
 * - `payout`        — beneficiary funds disbursed out of the platform (a payout
 *                     debits `beneficiary` and credits `payout`; a reversal
 *                     posts the opposite balanced entry)
 */
export type LedgerAccountKind =
  | 'campaign'
  | 'platform_fee'
  | 'processor_fee'
  | 'tip'
  | 'beneficiary'
  | 'payout'

/**
 * A single account in the chart of accounts. Identified by its `kind` plus an
 * `ownerId`: campaign/beneficiary accounts are scoped to a campaign id, while
 * the platform-wide accounts (`platform_fee`, `processor_fee`, `tip`) use the
 * sentinel owner `platform`.
 */
export interface LedgerAccount {
  id: string
  kind: LedgerAccountKind
  /** Campaign id for campaign/beneficiary accounts; `platform` otherwise. */
  ownerId: string
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency. */
  currency: string
  createdAt: Date
}

/** Platform-wide accounts share this sentinel owner id. */
export const PLATFORM_ACCOUNT_OWNER = 'platform'

export type JournalDirection = 'debit' | 'credit'

/**
 * One leg of a journal entry. `accountKind` is denormalized onto the line so
 * projections (e.g. summing `campaign` debits) never need to join accounts.
 */
export interface JournalLine {
  id: string
  journalEntryId: string
  accountId: string
  accountKind: LedgerAccountKind
  /** Campaign id for campaign/beneficiary lines; `platform` otherwise. */
  accountOwnerId: string
  direction: JournalDirection
  amount: number
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency. */
  currency: string
  createdAt: Date
}

/**
 * An immutable, append-only ledger entry: a balanced set of {@link JournalLine}s
 * recorded as one atomic unit. A donation entry references the donation +
 * donation-intent it settled.
 */
export interface JournalEntry {
  id: string
  donationId?: string
  donationIntentId?: string
  memo: string
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency. */
  currency: string
  createdAt: Date
  lines: JournalLine[]
}

/**
 * The provider-computed money split a settlement records. Passed to
 * `settleDonation(intent, breakdown)` by every payment rail (the wallet rail
 * today; the Paystack rail in Phase 4).
 *
 * Invariants (asserted before posting):
 *   beneficiaryNet = amount - platformFee - processorFee   (>= 0)
 *   gross          = amount + tip
 * `amount` is the campaign-directed donation (drives the campaign raised
 * total); `tip` is an optional donor gift to the platform, excluded from the
 * campaign total.
 */
export interface DonationSettlementBreakdown {
  /** Campaign-directed donation, before fees. Drives the raised total. */
  amount: number
  /** Optional donor tip to the platform (excluded from the campaign total). */
  tip: number
  /** Payment-processor fee taken out of `amount`. Zero for the wallet rail. */
  processorFee: number
  /** Platform revenue fee taken out of `amount`. */
  platformFee: number
  /** What the beneficiary can be paid out: amount - platformFee - processorFee. */
  beneficiaryNet: number
  /** Total the donor was charged: amount + tip. */
  gross: number
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency. */
  currency: string
  /** Provider settlement reference (e.g. Paystack transaction ref). */
  providerRef?: string
}

/**
 * Per-campaign beneficiary-balance read model, projected from posted ledger
 * activity. Separates the money into lifecycle buckets:
 *   pending   → beneficiary-net settled but not yet cleared for payout
 *   available → cleared and withdrawable
 *   paidOut   → already disbursed to the beneficiary
 *
 * A payout/clearing rail (a later phase) moves funds pending → available →
 * paidOut; until then settled donations accrue in `pendingBalance`.
 */
export interface CampaignBalance {
  campaignId: string
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency. */
  currency: string
  /** Sum of campaign-directed donation `amount`s (matches the raised total). */
  totalRaised: number
  /** Beneficiary-net settled, awaiting a payout/clearing run. */
  pendingBalance: number
  /** Beneficiary-net cleared and withdrawable (0 until the payout phase). */
  availableBalance: number
  /** Beneficiary-net already disbursed (0 until the payout phase). */
  paidOutBalance: number
  /** Accumulated platform fees earned from this campaign. */
  platformFees: number
  /** Accumulated processor fees paid for this campaign. */
  processorFees: number
  /** Accumulated donor tips collected alongside this campaign's donations. */
  tips: number
  updatedAt: Date
}

/** The durable side-effects the outbox reliably dispatches after a commit. */
export type OutboxEventType = 'donation.succeeded'

export type OutboxStatus = 'pending' | 'dispatched'

/**
 * A transactional-outbox row. Written in the same step a donation is settled,
 * then dispatched in-process after the write; a boot-time sweep re-dispatches
 * anything still `pending` so realtime/receipt side-effects survive restarts.
 */
export interface OutboxRecord<T = unknown> {
  id: string
  type: OutboxEventType
  payload: T
  status: OutboxStatus
  attempts: number
  createdAt: Date
  dispatchedAt?: Date
}

/** Payload of a `donation.succeeded` outbox event. */
export interface DonationSucceededPayload {
  donationId: string
  donationIntentId: string
  campaignId: string
  liveSessionId?: string
  donorId: string
  /** Resolved donor display name (used for guests with no user record). */
  donorName?: string
  amount: number
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency. */
  currency: string
  message?: string
  isAnonymous: boolean
  /** ISO-8601 timestamp of the settlement. */
  createdAt: string
}
