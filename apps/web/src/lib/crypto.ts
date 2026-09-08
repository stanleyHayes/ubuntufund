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

/** POST a deposit against an accepted quote — returns the address to fund. */
export function createCryptoDeposit(
  campaignId: string,
  input: CreateCryptoDepositInput,
): Promise<CryptoDepositView> {
  return api.post<CryptoDepositView>(`/campaigns/${campaignId}/donations/crypto`, input)
}
