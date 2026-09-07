/**
 * Payouts: disbursing a campaign's accumulated, cleared beneficiary funds to a
 * real bank / mobile-money account via Paystack Transfers (Ghana, GHS).
 *
 * A {@link TransferRecipient} is the stored, provider-registered destination a
 * campaign pays out to. A {@link Payout} is a single disbursement request that
 * moves money through the lifecycle:
 *
 *   PENDING    → owner requested; awaiting admin approval (no money moved yet)
 *   PROCESSING → admin approved; transfer initiated (funds reserved out of the
 *                campaign's `availableBalance`, "in transit")
 *   PAID       → provider confirmed `transfer.success` (funds → `paidOutBalance`)
 *   FAILED     → provider `transfer.failed` before success (reservation returned
 *                to `availableBalance`)
 *   REVERSED   → provider `transfer.reversed` a previously-successful transfer
 *                (funds returned from `paidOutBalance` to `availableBalance`)
 */

/** How a recipient is paid: a Ghana bank account, or a mobile-money wallet. */
export type PayoutRecipientType = 'ghipss' | 'mobile_money'

export type PayoutStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'REVERSED'
  /**
   * A batched (multi-leg) payout that did not settle cleanly: at least one
   * transfer leg failed or reversed while others succeeded. Real money already
   * left on the successful legs and cannot be un-sent, so the payout is frozen
   * for manual admin reconciliation rather than auto-resolved. Terminal.
   */
  | 'NEEDS_REVIEW'

/** State of one transfer leg of a batched payout (spec §17 / ADR-4). */
export type PayoutLegStatus =
  /** Created, not yet submitted to the provider. */
  | 'queued'
  /** Submitted to the provider; awaiting the transfer webhook. */
  | 'submitted'
  /** Provider confirmed `transfer.success` for this leg. */
  | 'success'
  /** Provider `transfer.failed` (or submission was rejected) — funds returned. */
  | 'failed'
  /** Provider `transfer.reversed` a previously-successful leg. */
  | 'reversed'

/**
 * One transfer of a batched payout. A payout whose net exceeds the provider's
 * single-transfer ceiling (`PAYOUT_MAX_TRANSFER_AMOUNT`) is split into several
 * legs, each ≤ the ceiling, each with its own idempotency reference the
 * `transfer.*` webhook correlates on. Single-transfer payouts have no legs.
 */
export interface PayoutLeg {
  /** 0-based position within the batch. */
  index: number
  /** Leg amount transferred (major units, GHS); the legs sum to `netAmount`. */
  amount: number
  /** Unique provider transfer reference for this leg; the webhook correlates on it. */
  reference: string
  /** Provider transfer handle, once the leg is submitted. */
  transferCode?: string
  status: PayoutLegStatus
}

/**
 * The payout service requested (spec §17). `standard` is free and post-close;
 * the rest are optional, fee-bearing services:
 *  - priority: faster settlement of already-eligible funds
 *  - early:    before campaign end (subject to the reserve ceiling)
 *  - urgent:   accelerated early payout
 *  - assisted: bank-mediated/offline payout (fixed service charge added)
 * The fee is deducted from the disbursed amount: the beneficiary receives
 * `amount − fee`.
 */
export type PayoutType = 'standard' | 'priority' | 'early' | 'urgent' | 'assisted'

/** The only payout provider today. */
export type PayoutProvider = 'paystack'

/**
 * A bank or mobile-money telco as returned by the provider's bank directory.
 * `code` is what a {@link TransferRecipient} stores as its `bankCode`.
 */
export interface Bank {
  name: string
  code: string
  /** Currency the institution settles in (e.g. 'GHS'). */
  currency?: string
  /** 'ghipss' for banks, 'mobile_money' for telcos (when the provider tags it). */
  type?: string
  active?: boolean
}

/**
 * A provider-registered payout destination for a campaign. `recipientCode` is
 * the opaque Paystack recipient handle a transfer is addressed to.
 */
export interface TransferRecipient {
  id: string
  campaignId: string
  /** The user (owner) who registered the recipient. */
  createdBy: string
  type: PayoutRecipientType
  /** Bank account number, or the phone number for mobile money. */
  accountNumber: string
  /** Bank code, or the telco code for mobile money. */
  bankCode: string
  accountName: string
  /** Opaque provider recipient handle; addresses transfers. */
  recipientCode: string
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency. */
  currency: string
  createdAt: Date
}

/**
 * A single disbursement of cleared campaign funds to a {@link TransferRecipient}.
 * Amounts are in MAJOR currency units (GHS), consistent with the rest of the
 * ledger; the gateway converts to pesewas at the provider boundary.
 */
export interface Payout {
  id: string
  campaignId: string
  recipientId: string
  /** Gross disbursement amount debited from the campaign (major units, GHS). */
  amount: number
  /** The payout service requested (spec §17). Defaults to `standard`. */
  type: PayoutType
  /** Ujimora service fee for this payout in GHS (0 for `standard`). */
  fee: number
  /** Net amount actually transferred to the beneficiary = `amount − fee`. */
  netAmount: number
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency. */
  currency: string
  status: PayoutStatus
  provider: PayoutProvider
  /** Our unique transfer reference; the webhook correlates back on this. */
  providerRef?: string
  /** Provider transfer handle returned when the transfer is initiated. */
  transferCode?: string
  requestedBy: string
  /**
   * The admin who gave the final (transfer-initiating) approval. For a
   * maker-checker payout this is the checker; {@link Payout.firstApprovedBy} is
   * the maker.
   */
  approvedBy?: string
  /**
   * Maker-checker (spec §16 / ADR-4): the first admin to approve a high-value
   * payout (≥ `PAYOUT_DUAL_APPROVAL_AMOUNT`). The payout stays PENDING until a
   * second, different admin approves. Undefined for single-approval payouts.
   */
  firstApprovedBy?: string
  firstApprovedAt?: Date
  /**
   * Transfer legs for a batched payout (net > the single-transfer ceiling).
   * Undefined/empty for an ordinary single-transfer payout.
   */
  legs?: PayoutLeg[]
  createdAt: Date
  updatedAt: Date
}

/** Owner input for registering a payout recipient on a campaign. */
export interface CreatePayoutRecipientInput {
  type: PayoutRecipientType
  accountNumber: string
  bankCode: string
  accountName: string
}

/** Owner input for requesting a payout of cleared funds. */
export interface RequestPayoutInput {
  amount: number
  /** The payout service; defaults to `standard` (free). */
  type?: PayoutType
}

/**
 * A quote for a payout request (spec §17): the fee for the chosen service and
 * the net the beneficiary would receive, shown BEFORE the organizer confirms.
 */
export interface PayoutQuote {
  type: PayoutType
  amount: number
  fee: number
  netAmount: number
  currency: string
}
