/**
 * Donation intents model a single guest-capable checkout from creation through
 * settlement. An intent is the money-changing record every donation flows
 * through; its `idempotencyKey` makes repeated submits safe (the same key
 * always resolves to the same intent — no double charge).
 *
 * Lifecycle (state machine):
 *   CREATED → PENDING → SUCCEEDED | FAILED | EXPIRED
 * The wallet rail settles synchronously (CREATED → SUCCEEDED); hosted rails
 * (Paystack, Phase 4) move CREATED → PENDING on init, then to a terminal state
 * on webhook/confirmation. SUCCEEDED, FAILED, and EXPIRED are terminal.
 */
export type DonationIntentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'REQUIRES_ACTION' // e.g. 3-D Secure / OTP awaiting the contributor
  | 'PROCESSING' // authorized, provider settling
  | 'SUCCEEDED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'DISPUTED'
  | 'CHARGEBACK'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'

import type { CryptoAsset, CryptoProvider, PaymentRail } from './crypto'

/**
 * The payment rail an intent settles through. Fiat rails (wallet, Paystack,
 * Flutterwave) plus the provider-neutral crypto providers (plan §2). Crypto
 * donations never traverse the fiat gateway paths — they have their own
 * quote/deposit/webhook use-cases — so adding the crypto values here is purely
 * additive to the fiat flow.
 */
export type DonationProvider = 'wallet' | 'paystack' | 'flutterwave' | CryptoProvider

/** How the contributor pays (spec §6 capabilities / §8 payment_method). */
export type ContributionMethod = 'mobile_money' | 'card' | 'bank' | 'ussd' | 'wallet'

/**
 * A guest-capable donation intent.
 *
 * `donorUserId` is null for guest checkouts; guests are identified only by the
 * optional `donorEmail`/`donorName` they supply. `amount` is the
 * campaign-directed donation; `tip` (default 0) is an optional gift to the
 * platform charged on top.
 */
export interface DonationIntent {
  id: string
  campaignId: string
  /** When set, attributes the donation to a live session's overlay + stats. */
  liveSessionId?: string
  amount: number
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency. */
  currency: string
  /** Null for guest checkouts. */
  donorUserId: string | null
  donorEmail?: string
  donorName?: string
  message?: string
  isAnonymous: boolean
  /** Optional donor tip to the platform, charged on top of `amount`. */
  tip: number
  status: DonationIntentStatus
  provider: DonationProvider
  /** Provider settlement reference, populated once known. */
  providerRef?: string
  /** Repeated submits with the same key resolve to this same intent. */
  idempotencyKey: string
  /** Coarse attribution token (e.g. a QR/utm source). Never PII. */
  attribution?: string
  createdAt: Date
  updatedAt: Date

  // ── Multi-currency & settlement (spec §8) ─────────────────────────────────
  // All optional/nullable and additive: legacy GHS records simply omit them
  // (derive from `amount`/`currency`). New/diaspora contributions populate the
  // integer-minor-unit fields, which are the financial source of truth.
  /** Contributor-facing charge (amount + tip) in integer minor units. */
  originalAmountMinor?: number
  /** Currency the contributor authorized in (ISO-4217). */
  originalCurrency?: string
  /** Amount actually settled by the provider, in minor units. */
  settlementAmountMinor?: number
  /** Currency the provider settled in (often the merchant's home currency). */
  settlementCurrency?: string
  /** Exact FX rate used/observed (original → settlement); null until known. */
  fxRate?: number
  /** Where the FX rate came from (e.g. 'provider', 'manual'). */
  fxSource?: string
  /** ISO-3166 alpha-2 contributor country, when safely derivable. */
  country?: string
  /** How the contributor paid. */
  paymentMethod?: ContributionMethod
  /** Provider fee, minor units of the settlement currency. */
  providerFeeMinor?: number
  /** Ujimora platform fee, minor units. */
  platformFeeMinor?: number
  /**
   * Platform fee rate locked onto this donation by a fee-waiver coupon.
   *
   * Locked at intent creation for the same reason a campaign locks its own
   * rate: the donor was shown a split, and re-deriving it at settlement would
   * let a later coupon edit change what a completed donation credited. Absent
   * on every donation without a coupon, which is the overwhelming majority.
   */
  platformFeePercentOverride?: number
  /** The fee-waiver coupon applied, for reconciliation and redemption. */
  couponId?: string
  couponCode?: string
  /** Net credited to the campaign, minor units. */
  netCampaignAmountMinor?: number

  // ── Crypto rail (Crypto Donations plan §6) — all optional/additive ────────
  // Absent ⇒ a fiat donation (unchanged). Present ⇒ a crypto contribution whose
  // GHS-equivalent (in the minor-unit fields above) credits the campaign only
  // once CONFIRMED.
  /** FIAT (default/legacy) or CRYPTO. */
  paymentRail?: PaymentRail
  /** The crypto asset the contributor sent. */
  cryptoAsset?: CryptoAsset
  /** The blockchain network the deposit was made on. */
  cryptoNetwork?: string
  /** Provider-issued destination address for this deposit. */
  walletAddress?: string
  /** On-chain transaction hash, once observed. */
  transactionHash?: string
  /** Confirmations observed so far. */
  confirmationCount?: number
  /** Confirmations required before CONFIRMED (from the network config). */
  requiredConfirmations?: number
  /** The accepted quote's id (locks the rate). */
  quoteId?: string
  /** When the accepted quote expires; a deposit past this is EXPIRED. */
  quoteExpiresAt?: Date
}

export type PaymentAttemptStatus = 'initiated' | 'succeeded' | 'failed'

/**
 * A single attempt to pay an intent through a provider. An intent may collect
 * several attempts (e.g. a failed card retry) before it settles.
 */
export interface PaymentAttempt {
  id: string
  intentId: string
  provider: DonationProvider
  providerRef?: string
  status: PaymentAttemptStatus
  /** Raw provider response, retained for debugging/audit. */
  raw?: Record<string, unknown>
  createdAt: Date

  // ── Attempt detail (spec §8 PaymentAttempt) — all optional/additive ───────
  /** Requested charge in integer minor units. */
  requestedAmountMinor?: number
  /** Requested currency (ISO-4217). */
  requestedCurrency?: string
  /** Idempotency key this attempt was created under. */
  idempotencyKey?: string
  /** Normalized failure code, when the attempt failed. */
  failureCode?: string
  /** Human-readable failure reason. */
  failureReason?: string
  /** Hosted checkout URL or provider session id. */
  checkoutUrlOrSessionId?: string
}

/**
 * Body for `POST /donation-intents` (PUBLIC — guests allowed). The
 * idempotency key is taken from the `Idempotency-Key` request header (or
 * `idempotencyKey` here as a fallback); clients should send one to make
 * retries safe.
 */
export interface CreateDonationIntentInput {
  campaignId: string
  liveSessionId?: string
  amount: number
  tip?: number
  provider: DonationProvider
  donorEmail?: string
  donorName?: string
  message?: string
  isAnonymous?: boolean
  attribution?: string
  /** Fallback idempotency key when the `Idempotency-Key` header is absent. */
  idempotencyKey?: string
  /** Contribution currency (ISO-4217). Defaults to the platform currency (GHS). */
  currency?: string
  /** ISO-3166 alpha-2 contributor country, when safely known. */
  country?: string
  /** Preferred payment method; drives provider routing (spec §7). */
  paymentMethod?: ContributionMethod
  /** Explicit provider request; honored only when eligible. */
  providerPreference?: DonationProvider
  /**
   * A fee-waiver code. It reduces the PLATFORM FEE, never what the donor gives
   * — the donor pays exactly the amount they chose and the campaign receives
   * more of it. An invalid code is refused rather than ignored, because a donor
   * who typed one is expecting the campaign to benefit.
   */
  couponCode?: string
}

/** Body for `POST /donation-intents/:id/payment-attempts`. */
export interface RecordPaymentAttemptInput {
  provider: DonationProvider
  providerRef?: string
  status: PaymentAttemptStatus
  raw?: Record<string, unknown>
}

/**
 * Public, poll-friendly view of an intent (`GET /donation-intents/:id/public`).
 * Omits the idempotency key and any donor PII beyond the display name.
 */
export interface DonationIntentPublicView {
  id: string
  campaignId: string
  liveSessionId?: string
  amount: number
  tip: number
  /** Currency code — 'GHS' (Ghanaian cedi) is the platform's only currency. */
  currency: string
  status: DonationIntentStatus
  provider: DonationProvider
  isAnonymous: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * The hosted-checkout handoff returned when a `paystack` intent is created.
 * The snake_case fields mirror Paystack's own initialize response: the donor's
 * browser is redirected to `authorization_url` (or the `access_code` is handed
 * to Paystack Inline). Settlement itself is authoritative via the signed
 * `charge.success` webhook, never this redirect.
 */
export interface HostedPaymentInit {
  /** Paystack-hosted payment page the donor is sent to. */
  authorization_url: string
  /** Access code for Paystack Inline (client-side checkout). */
  access_code: string
  /** Our unique transaction reference; correlates the later webhook. */
  reference: string
}

/**
 * Response body of `POST /donation-intents` when `provider: 'paystack'`.
 * Wraps the created (PENDING) intent alongside the hosted-checkout handoff.
 * The wallet rail instead returns the intent view directly.
 */
export interface PaystackCheckoutInit extends HostedPaymentInit {
  intent: DonationIntentPublicView & { providerRef?: string }
}

/** Body for `POST /donations/:id/message` (add/edit a donation's public message). */
export interface AddDonationMessageInput {
  message: string
}
