import { api } from './api'

// Creator tip jar (buy-me-a-coffee) — mobile client. Mirrors the web flow:
// tips collect through the shared gateway (open the returned checkout URL in an
// in-app browser); the balance is credited by the signed webhook.

export interface CreatorPage {
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
  recentTips: Array<{ supporterName: string; amount: number; message?: string }>
}

export interface CreatorBalance {
  availableBalance: number
  paidOutBalance: number
  totalReceived: number
  currency: string
}

export interface CreatorProfile {
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
  handle: string
  displayName: string
  tagline?: string
  bio?: string
  tipsEnabled?: boolean
}): Promise<CreatorProfile> {
  return api.post<CreatorProfile>('/creators/profile', input)
}

export function createTip(
  handle: string,
  input: {
    amount: number
    supporterEmail: string
    supporterName?: string
    message?: string
    isAnonymous?: boolean
  },
): Promise<{ checkoutUrl: string; reference: string; tipId: string }> {
  return api.post(`/creators/${handle}/tips`, input)
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
