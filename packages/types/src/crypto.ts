/**
 * Crypto donation rail (Ujimora Crypto Donations plan). A provider-neutral
 * second payment rail alongside the fiat (Paystack) rail: campaigns still have a
 * single GHS target and one ledger — crypto contributions are quoted to a locked
 * GHS-equivalent, deposited to a provider-issued address, and only credit the
 * campaign once CONFIRMED. All types here are self-contained (no import from
 * donation-intent) so the two modules never form a cycle.
 */

/** Phase-1 stablecoins first (plan §1); BTC is Phase 2. */
export type CryptoAsset = 'USDT' | 'USDC' | 'BTC'

/**
 * Provider-neutral crypto providers (plan §2). `mock` is the built-in sandbox
 * provider used for local dev + tests; the real providers drop in behind the
 * same {@link CryptoPaymentProviderPort} once onboarded.
 */
export type CryptoProvider = 'mock' | 'yellowcard' | 'paychant' | 'bitnob'

/** The payment rail an intent settles through (plan §6). Absent ⇒ FIAT (legacy). */
export type PaymentRail = 'FIAT' | 'CRYPTO'

/**
 * Contributor-facing crypto status (plan §6 vocabulary). Derived from the shared
 * DonationIntent state machine so the crypto rail reuses the exactly-once
 * settlement gate rather than inventing a parallel one:
 *   PENDING → AWAITING_PAYMENT · PROCESSING → PENDING_CONFIRMATION ·
 *   SUCCEEDED → CONFIRMED · EXPIRED → EXPIRED · FAILED/CANCELLED → FAILED.
 */
export type CryptoDonationStatus =
  | 'AWAITING_PAYMENT'
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'EXPIRED'
  | 'FAILED'

/** A blockchain network an asset can be received on (server-allowlisted, §15). */
export interface CryptoNetworkInfo {
  /** Stable network id, e.g. 'TRON', 'ETHEREUM', 'BSC', 'BITCOIN'. */
  id: string
  /** Human label, e.g. 'Tron (TRC-20)'. */
  label: string
  /** Confirmations required before a deposit becomes CONFIRMED (§7). */
  requiredConfirmations: number
}

/** A supported asset + the networks it can be received on. */
export interface CryptoAssetInfo {
  asset: CryptoAsset
  label: string
  networks: CryptoNetworkInfo[]
}

/**
 * An expiring price quote (§9). Fiat amounts are the campaign currency (GHS);
 * `cryptoAmount` is what the contributor must send. The rate is locked into the
 * donation at deposit time and never recalculated with a later rate.
 */
export interface CryptoQuote {
  quoteId: string
  asset: CryptoAsset
  network: string
  fiatCurrency: string
  fiatAmount: number
  cryptoAmount: number
  /** Locked rate: 1 unit of `asset` = `rate` `fiatCurrency`. */
  rate: number
  /** Provider fee, in fiat, when quoted separately. */
  providerFeeFiat?: number
  /** Network/gas fee, in fiat, when quoted separately. */
  networkFeeFiat?: number
  /** ISO-8601 expiry; a deposit against an expired quote is rejected. */
  expiresAt: string
}

/** Body for `POST /campaigns/:id/donations/crypto/quote`. */
export interface CreateCryptoQuoteInput {
  /** GHS the campaign should be credited. */
  fiatAmount: number
  asset: CryptoAsset
  network: string
}

/** Body for `POST /campaigns/:id/donations/crypto` (open a funded deposit). */
export interface CreateCryptoDepositInput {
  quoteId: string
  donorEmail?: string
  donorName?: string
  message?: string
  isAnonymous?: boolean
  attribution?: string
  idempotencyKey?: string
}

/**
 * The deposit the contributor funds (§7): the exact destination address on the
 * exact network, the amount, and the expiry. Returned once the intent is
 * persisted, never before.
 */
export interface CryptoDepositView {
  donationIntentId: string
  provider: CryptoProvider
  asset: CryptoAsset
  network: string
  /** Exact destination address on the exact network. */
  walletAddress: string
  /** Optional memo/destination-tag some chains require. */
  addressTag?: string
  cryptoAmount: number
  fiatAmount: number
  fiatCurrency: string
  rate: number
  expiresAt: string
  status: CryptoDonationStatus
  /** Provider reference for support/tracing/webhook correlation. */
  providerRef: string
}

/**
 * A provider webhook normalized into Ujimora's vocabulary (§4/§8). Provider
 * adapters translate their payloads into this; the domain never sees a raw
 * provider payload as source of truth.
 */
export interface CryptoWebhookEvent {
  /** Provider's unique event id — deduped on (provider, eventId). */
  eventId: string
  type: 'deposit.detected' | 'deposit.confirmed' | 'deposit.failed'
  /** The providerRef we correlate the deposit on. */
  providerRef: string
  transactionHash?: string
  /** Crypto amount observed received (major units), when known. */
  cryptoAmount?: number
  confirmations?: number
  raw: Record<string, unknown>
}
