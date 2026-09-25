import { api } from './api'
import type {
  CryptoAssetInfo,
  CryptoQuote,
  CryptoDepositView,
  CreateCryptoQuoteInput,
  CreateCryptoDepositInput,
} from '@ubuntu-fund/types'

/** GET /payments/crypto/assets — enabled flag + server-driven asset/network set. */
export interface CryptoAssetsResult {
  enabled: boolean
  assets: CryptoAssetInfo[]
}

export function getCryptoAssets(): Promise<CryptoAssetsResult> {
  return api.get<CryptoAssetsResult>('/payments/crypto/assets')
}

/** POST a quote for a campaign — an expiring, server-locked GHS↔crypto rate. */
export function createCryptoQuote(
  campaignId: string,
  input: CreateCryptoQuoteInput,
): Promise<CryptoQuote> {
  return api.post<CryptoQuote>(`/campaigns/${campaignId}/donations/crypto/quote`, input)
}

/**
 * POST a deposit against an accepted quote — returns the address to fund.
 * Pass the same `idempotencyKey` when retrying the same quote, so a lost
 * response returns the same deposit address instead of opening another one.
 */
export function createCryptoDeposit(
  campaignId: string,
  input: CreateCryptoDepositInput,
  idempotencyKey: string,
): Promise<CryptoDepositView> {
  return api.post<CryptoDepositView>(`/campaigns/${campaignId}/donations/crypto`, input, { 'Idempotency-Key': idempotencyKey })
}
