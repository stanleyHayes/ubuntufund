import type { LegalAcceptanceInput } from '@ubuntu-fund/types'
import { paymentScope, paymentKey, savePending, loadPending, clearPending } from './payments'
import { api } from './api'
import { Platform } from 'react-native'

// Creator profiles and balances remain available on native. External tip
// checkout is web-only until the store payment model is approved/implemented.

export interface CreatorPage {
  userId: string
  handle: string
  displayName: string
  tagline?: string
  bio?: string
  coverUrl?: string
  avatarUrl?: string
  tipsEnabled: boolean
  presetAmounts: number[]
  currency: string
  supporterCount: number
  totalReceived: number
  recentTips: Array<{ id: string; supporterName: string; amount: number; message?: string }>
}

export interface CreatorBalance {
  availableBalance: number
  paidOutBalance: number
  totalReceived: number
  currency: string
}

export interface CreatorProfile {
  avatarUrl?: string
  coverUrl?: string
  handle: string
  displayName: string
  tagline?: string
  bio?: string
  tipsEnabled: boolean
  presetAmounts: number[]
  currency: string
}

export interface CreatorPolicy {
  eligible: boolean
  planName: string
  feePercent: number
}

export interface CreatorPayout {
  id: string
  amount: number
  fee?: number
  netAmount?: number
  status: string
  createdAt: string
}

export function getCreatorByHandle(handle: string): Promise<CreatorPage> {
  return api.get<CreatorPage>(`/creators/${handle}`)
}

export function saveCreatorProfile(input: {
  automatedReviewConsent?: boolean
  avatarUrl?: string
  coverUrl?: string
  handle?: string
  displayName?: string
  tagline?: string
  bio?: string
  tipsEnabled?: boolean
}): Promise<CreatorProfile> {
  return api.post<CreatorProfile>('/creators/profile', input)
}

export async function createTip(
  handle: string,
  input: {
    amount: number
    supporterEmail: string
    legalAcceptance?: LegalAcceptanceInput
    supporterName?: string
    message?: string
    isAnonymous?: boolean
  },
): Promise<{ checkoutUrl: string; reference: string; tipId: string }> {
  if (Platform.OS !== 'web') return Promise.reject(new Error('Creator tips are not available in this app yet.'))
  const scope = paymentScope('creator-tip', handle)
  const key = await paymentKey(scope, {})
  const result = await api.post<{ checkoutUrl: string; reference: string; tipId: string }>(`/creators/${handle}/tips`, input, { 'Idempotency-Key': key })
  await savePending(scope, { id: result.tipId, reference: result.reference, status: 'PENDING', storageKey: scope })
  return result
}

export function getMyCreator(): Promise<{
  profile: CreatorProfile | null
  balance: CreatorBalance | null
  policy: CreatorPolicy
}> {
  return api.get('/creators/me')
}

export function requestWithdrawal(input: {
  destination?: 'paystack' | 'ujimora_wallet'
  idempotencyKey?: string
  amount: number
  expectedFeePercent: number
  savedAccountId?: string
  recipient?: {
    type: 'mobile_money' | 'ghipss'
    accountNumber: string
    bankCode: string
    accountName: string
  }
}): Promise<{ id: string; status: string; amount: number }> {
  return api.post('/creators/withdraw', input)
}

export function listMyPayouts(): Promise<CreatorPayout[]> {
  return api.get<CreatorPayout[]>('/creators/me/payouts')
}

export async function verifyTip(handle: string, reference: string): Promise<{ status: string; contentReviewStatus?: string }> {
  const scope = paymentScope('creator-tip', handle)
  const result = await api.post<{ status: string; contentReviewStatus?: string }>('/creators/tips/verify', { reference })
  if (result.status === 'SUCCEEDED' || result.status === 'FAILED') {
    // A local cleanup failure must not hide the provider-confirmed outcome.
    try {
      const pending = await loadPending(scope)
      if (pending?.reference === reference) await clearPending(scope)
    } catch { /* The retained attempt can still replay confirmation safely. */ }
  }
  return result
}
