import type {
  CryptoAsset,
  CryptoDonationStatus,
  DonationIntentStatus,
} from '@ubuntu-fund/types';

/** On-chain decimals per asset (stablecoins 6, BTC 8). */
export function cryptoDecimals(asset: CryptoAsset): number {
  return asset === 'BTC' ? 8 : 6;
}

/** Convert a crypto amount to integer minor units (never float for balances, §6). */
export function cryptoToMinor(amount: number, asset: CryptoAsset): number {
  return Math.round(amount * 10 ** cryptoDecimals(asset));
}

/** Convert integer minor units back to a crypto amount. */
export function cryptoFromMinor(minor: number, asset: CryptoAsset): number {
  const f = 10 ** cryptoDecimals(asset);
  return Math.round((minor / f) * f) / f;
}

/**
 * Map the shared DonationIntent state onto the contributor-facing crypto status
 * (plan §6). PROCESSING (or PENDING with a tx observed) = PENDING_CONFIRMATION;
 * SUCCEEDED = CONFIRMED.
 */
export function toCryptoStatus(
  status: DonationIntentStatus,
  hasTx: boolean
): CryptoDonationStatus {
  switch (status) {
    case 'SUCCEEDED':
      return 'CONFIRMED';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'FAILED':
    case 'CANCELLED':
      return 'FAILED';
    case 'PROCESSING':
      return 'PENDING_CONFIRMATION';
    default:
      return hasTx ? 'PENDING_CONFIRMATION' : 'AWAITING_PAYMENT';
  }
}
