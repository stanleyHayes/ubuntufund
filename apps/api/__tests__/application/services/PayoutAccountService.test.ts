import { describe, it, expect, vi } from 'vitest'
import { PayoutAccountService } from '../../../src/application/services/PayoutAccountService.js'
import type { SavedPayoutAccount } from '../../../src/domain/ports/outbound/PayoutAccountRepositoryPort.js'
const input = {
  type: 'mobile_money' as const,
  accountNumber: '0241234567',
  accountName: 'Jane Doe',
  bankCode: 'MTN',
}
function setup(limit = 1) {
  const rows: Record<string, SavedPayoutAccount[]> = {}
  const repo = {
    list: async (id: string) => rows[id] ?? [],
    remove: async (id: string, key: string) => {
      rows[id] = (rows[id] ?? []).filter((a) => a.id !== key)
    },
    addWithinLimit: vi.fn(async (id: string, a: SavedPayoutAccount, max: number) => {
      const list = (rows[id] ??= [])
      if (list.some((v) => v.fingerprint === a.fingerprint) || (max >= 0 && list.length >= max))
        return false
      list.push(a)
      return true
    }),
  }
  const gateway = {
    resolveAccount: vi.fn(async () => ({ accountName: 'Jane Doe' })),
    createTransferRecipient: vi.fn(async () => 'RCP_test'),
  }
  const plan = { name: 'Pro', tier: 'pro', maxPayoutAccounts: limit }
  const service = new PayoutAccountService(
    repo,
    gateway as never,
    { resolvePlan: async () => plan } as never,
  )
  return { service, repo, gateway, plan }
}
describe('saved payout account limits', () => {
  it('returns masked accounts and the live admin limit', async () => {
    const { service, plan } = setup(3)
    await service.add('owner', input)
    plan.maxPayoutAccounts = 5
    const data = await service.list('owner')
    expect(data.limit).toBe(5)
    expect(data.accounts[0]).toMatchObject({ last4: '4567', verificationStatus: 'name_matched' })
    expect(data.accounts[0]).not.toHaveProperty('accountNumber')
    expect(data.accounts[0]).not.toHaveProperty('recipientCode')
  })
  it('blocks an additional account before contacting Paystack at the plan cap', async () => {
    const { service, gateway } = setup()
    await service.add('owner', input)
    await expect(
      service.add('owner', { ...input, accountNumber: '0247654321' }),
    ).rejects.toMatchObject({ statusCode: 403 })
    expect(gateway.createTransferRecipient).toHaveBeenCalledTimes(1)
  })
  it('deduplicates Ghana international/local mobile numbers', async () => {
    const { service, gateway } = setup()
    const first = await service.add('owner', input)
    const second = await service.add('owner', { ...input, accountNumber: '+233241234567' })
    expect(second.id).toBe(first.id)
    expect(gateway.createTransferRecipient).toHaveBeenCalledTimes(1)
  })
  it('limits competing saves through the atomic repository operation', async () => {
    const { service } = setup()
    const results = await Promise.allSettled([
      service.add('owner', input),
      service.add('owner', { ...input, accountNumber: '0247654321' }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((await service.list('owner')).accounts).toHaveLength(1)
  })
  it('never allows selecting or deleting another owner’s account', async () => {
    const { service } = setup()
    const a = await service.add('owner', input)
    await expect(service.get('other', a.id)).rejects.toMatchObject({ statusCode: 404 })
    await expect(service.remove('other', a.id)).rejects.toMatchObject({ statusCode: 404 })
  })
  it('keeps existing accounts usable after a downgrade and frees a slot on removal', async () => {
    const { service, plan } = setup(2)
    const a = await service.add('owner', input)
    await service.add('owner', { ...input, accountNumber: '0247654321' })
    plan.maxPayoutAccounts = 1
    expect((await service.get('owner', a.id)).id).toBe(a.id)
    await service.remove('owner', a.id)
    expect((await service.list('owner')).accounts).toHaveLength(1)
  })
  it('supports unlimited and zero account plans', async () => {
    const { service } = setup(-1)
    await service.add('owner', input)
    await service.add('owner', { ...input, accountNumber: '0247654321' })
    expect((await service.list('owner')).accounts).toHaveLength(2)
    await expect(setup(0).service.add('owner', input)).rejects.toMatchObject({ statusCode: 403 })
  })
  it('keeps unverified names in review', async () => {
    const { service, gateway } = setup()
    gateway.resolveAccount.mockRejectedValue(new Error('unavailable'))
    expect((await service.add('owner', input)).verificationStatus).toBe('needs_review')
  })
})

import { GetCreatorByHandleUseCase } from '../../../src/application/use-cases/GetCreatorByHandleUseCase.js'
it.each([true, false])('respects profile image visibility (%s)', async (publicProfile) => {
  const uc = new GetCreatorByHandleUseCase(
    {
      findByHandle: async () => ({
        userId: 'owner',
        handle: 'pontifex',
        displayName: 'Stanley',
        tipsEnabled: true,
        presetAmounts: [10],
        currency: 'GHS',
      }),
    } as never,
    {
      creatorStats: async () => ({ count: 0, totalNet: 0 }),
      findByCreator: async () => [],
    } as never,
    { creatorPolicy: async () => ({ eligible: true }) } as never,
    {
      findById: async () => ({
        avatarUrl: 'https://example.com/photo.jpg',
        toPlain: () => ({ coverUrl: 'https://example.com/cover.jpg' }),
      }),
    } as never,
    { findByUserId: async () => ({ publicProfile }) } as never,
  )
  const page = await uc.execute('pontifex')
  expect(page.avatarUrl).toBe(publicProfile ? 'https://example.com/photo.jpg' : undefined)
  expect(page.coverUrl).toBe(publicProfile ? 'https://example.com/cover.jpg' : undefined)
})
