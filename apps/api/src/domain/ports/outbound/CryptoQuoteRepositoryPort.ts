import type { CryptoAsset } from '@ubuntu-fund/types';

/** A stored, server-locked crypto quote (Crypto Donations plan §9). */
export interface StoredCryptoQuote {
  quoteId: string;
  campaignId: string;
  provider: string;
  asset: CryptoAsset;
  network: string;
  fiatCurrency: string;
  fiatAmount: number;
  cryptoAmount: number;
  rate: number;
  providerFeeFiat: number;
  networkFeeFiat: number;
  requiredConfirmations: number;
  expiresAt: Date;
}

export interface CryptoQuoteRepositoryPort {
  save(quote: StoredCryptoQuote): Promise<void>;
  /** Resolve a quote by id (for the deposit step); null when unknown/purged. */
  findByQuoteId(quoteId: string): Promise<StoredCryptoQuote | null>;
}
