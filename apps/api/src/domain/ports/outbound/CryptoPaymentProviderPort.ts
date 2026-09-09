import type {
  CryptoAsset,
  CryptoAssetInfo,
  CryptoProvider,
  CryptoQuote,
  CryptoWebhookEvent,
} from '@ubuntu-fund/types';

/** A quote request against the provider (plan §5 GetQuote). */
export interface CryptoQuoteRequest {
  fiatAmount: number;
  fiatCurrency: string;
  asset: CryptoAsset;
  network: string;
}

/** Params for opening a provider deposit against an accepted quote (§5 CreateDeposit). */
export interface CryptoDepositRequest {
  quote: CryptoQuote;
  /** OUR correlation reference (the intent's providerRef); the webhook echoes it. */
  reference: string;
  metadata?: Record<string, unknown>;
}

/** Provider-side status of a deposit, polled during reconciliation (§5 GetDeposit). */
export interface CryptoDepositStatus {
  status: 'pending' | 'detected' | 'confirmed' | 'failed';
  cryptoAmount?: number;
  transactionHash?: string;
  confirmations?: number;
}

/** What a provider returns when a deposit address is issued. */
export interface CryptoDepositResult {
  /** Exact destination address on the quoted network. */
  walletAddress: string;
  /** Optional memo/destination-tag some chains require. */
  addressTag?: string;
  /** Provider's own deposit id (stored for tracing; correlation uses OUR reference). */
  providerDepositId?: string;
}

/**
 * Provider-neutral crypto rail port (plan §5). Provider adapters translate
 * external payloads into Ujimora domain types; business rules (campaign status,
 * fees, splits, totals) live OUTSIDE the adapter. The domain never treats a raw
 * provider payload as the source of truth — the {@link verifyWebhook} adapter
 * normalizes it first.
 */
export interface CryptoPaymentProviderPort {
  readonly provider: CryptoProvider;
  /** False ⇒ the rail is unavailable (missing secrets); the use-case 501s. */
  isConfigured(): boolean;
  /** Server-side supported assets + networks (never trusted from the client, §22 #4). */
  getSupportedAssets(): Promise<CryptoAssetInfo[]>;
  /** An expiring price quote locking the GHS-equivalent (§9). */
  getQuote(req: CryptoQuoteRequest): Promise<CryptoQuote>;
  /** Issue a deposit address for an accepted quote (§7 step 3). */
  createDeposit(req: CryptoDepositRequest): Promise<CryptoDepositResult>;
  /** Poll a deposit's current provider-side status (reconciliation seam, §7/§8). */
  getDeposit(reference: string): Promise<CryptoDepositStatus>;
  /**
   * Verify the webhook signature and normalize the payload (§8). Returns null
   * when the signature is invalid/absent — the caller then rejects the webhook.
   */
  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): CryptoWebhookEvent | null | Promise<CryptoWebhookEvent | null>;
}
