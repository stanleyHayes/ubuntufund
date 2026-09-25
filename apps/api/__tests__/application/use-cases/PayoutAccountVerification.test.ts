import { describe, expect, it, vi, afterEach } from 'vitest'
import { CreatePayoutRecipientUseCase } from '../../../src/application/use-cases/CreatePayoutRecipientUseCase.js'
import { ApprovePayoutUseCase } from '../../../src/application/use-cases/ApprovePayoutUseCase.js'
import { PaystackGateway } from '../../../src/infrastructure/adapters/outbound/payments/PaystackGateway.js'
import { PayoutAccountService } from '../../../src/application/services/PayoutAccountService.js'
import type { SavedPayoutAccount } from '../../../src/domain/ports/outbound/PayoutAccountRepositoryPort.js'
const input = {
  type: 'mobile_money' as const,
  accountName: 'Jane Doe',
  accountNumber: '0241234567',
  bankCode: 'MTN',
}
function setup(resolved: string | Error) {
  const gateway = {
    isConfigured: () => true,
    resolveAccount: vi.fn(async () => {
      if (resolved instanceof Error) throw resolved
      return { accountName: resolved }
    }),
    createTransferRecipient: vi.fn(async () => 'RCP_test'),
  }
  const recipients = { create: vi.fn(async (r) => r) }
  const uc = new CreatePayoutRecipientUseCase(
    { findById: async () => ({ id: 'campaign', creatorId: 'owner' }) } as never,
    recipients as never,
    gateway as never,
  )
  return { gateway, recipients, uc }
}
afterEach(() => vi.unstubAllGlobals())
describe('payout account verification', () => {
  it('checks campaign ownership before querying provider', async () => {
    const { uc, gateway } = setup('Jane Doe')
    await expect(uc.execute('campaign', input, { userId: 'other' })).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(gateway.resolveAccount).not.toHaveBeenCalled()
  })
  it('persists provider name and matching status without claiming ownership', async () => {
    const { uc, recipients } = setup('JANE DOE')
    await uc.execute('campaign', input, { userId: 'owner' })
    expect(recipients.create.mock.calls[0][0].toPlain()).toMatchObject({
      verificationStatus: 'name_matched',
      resolvedAccountName: 'JANE DOE',
    })
    expect(recipients.create.mock.calls[0][0].toPlain().reviewedBy).toBeUndefined()
  })
  it.each(['Another Person', new Error('resolution unavailable')])(
    'sends mismatch or unavailable resolution to review',
    async (name) => {
      const { uc, recipients } = setup(name)
      await uc.execute('campaign', input, { userId: 'owner' })
      expect(recipients.create.mock.calls[0][0].toPlain().verificationStatus).toBe('needs_review')
    },
  )
  it('resolves account through the server-side provider endpoint', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: true, data: { account_name: 'Jane Doe' } })),
    )
    vi.stubGlobal('fetch', fetcher)
    const g = new PaystackGateway({
      secretKey: 'sk_test_fixture',
      publicKey: '',
      publicWebUrl: 'http://localhost',
    })
    expect(await g.resolveAccount('0241234567', 'MTN')).toEqual({ accountName: 'Jane Doe' })
    expect(String(fetcher.mock.calls[0][0])).toContain(
      '/bank/resolve?account_number=0241234567&bank_code=MTN',
    )
  })
  it('blocks transfers without a recorded beneficiary/capacity review', async () => {
    const provider = { isConfigured: () => true, initiateTransfer: vi.fn() }
    const repo = { recordReview: vi.fn() }
    const uc = new ApprovePayoutUseCase(
      { findById: async () => ({ status: 'PENDING', recipientId: 'r' }) } as never,
      repo as never,
      {} as never,
      provider as never,
      {} as never,
    )
    await expect(uc.execute('p', { userId: 'admin', role: 'admin' })).rejects.toMatchObject({
      statusCode: 422,
    })
    expect(repo.recordReview).not.toHaveBeenCalled()
    expect(provider.initiateTransfer).not.toHaveBeenCalled()
  })
  it('does not split oversized MoMo transfers to work around limits', async () => {
    const gateway = { isConfigured: () => true, initiateTransfer: vi.fn() }
    const balance = { reserveForPayout: vi.fn() }
    const uc = new ApprovePayoutUseCase(
      {
        lockPendingForReview: async () => ({ status: 'PENDING', recipientId: 'r', netAmount: 60000, type: 'standard' }),
        findById: async () => ({
          status: 'PENDING',
          recipientId: 'r',
          netAmount: 60000,
          type: 'standard',
        }),
      } as never,
      { recordReview: vi.fn(), findById: async () => ({ type: 'mobile_money' }) } as never,
      balance as never,
      gateway as never,
      { maxTransferAmount: 50000, dualApprovalAmount: 0 } as never,
      undefined, undefined, undefined,
      { run: async (_requester, work) => work() },
    )
    await expect(
      uc.execute(
        'p',
        { userId: 'admin', role: 'admin' },
        'Beneficiary ownership and capacity reviewed',
      ),
    ).rejects.toThrow('not automatically split')
    expect(balance.reserveForPayout).not.toHaveBeenCalled()
    expect(gateway.initiateTransfer).not.toHaveBeenCalled()
  })
  it('requires durable review storage before moving funds', async () => {
    const provider = { isConfigured: () => true, initiateTransfer: vi.fn() }
    const uc = new ApprovePayoutUseCase(
      { findById: async () => ({ status: 'PENDING', recipientId: 'r' }) } as never,
      {} as never,
      {} as never,
      provider as never,
      {} as never,
    )
    await expect(
      uc.execute(
        'p',
        { userId: 'admin', role: 'admin' },
        'Ownership and receiving capacity checked',
      ),
    ).rejects.toMatchObject({ statusCode: 503 })
    expect(provider.initiateTransfer).not.toHaveBeenCalled()
  })
})

describe('saved payout account name checks', () => {
  function service(resolvedNames: (string | Error)[]) {
    const saved: SavedPayoutAccount[] = []
    const repo = {
      list: vi.fn(async () => saved.map((a) => ({ ...a }))),
      addWithinLimit: vi.fn(async (_u: string, a: SavedPayoutAccount) => { saved.push({ ...a }); return true }),
      remove: vi.fn(),
      updateVerification: vi.fn(async (_u: string, id: string, fingerprint: string, patch: Partial<SavedPayoutAccount>) => {
        const row = saved.find((a) => a.id === id && a.fingerprint === fingerprint)
        if (!row) return null
        Object.assign(row, patch)
        return { ...row }
      }),
    }
    const gateway = {
      resolveAccount: vi.fn(async () => {
        const next = resolvedNames.shift()
        if (next instanceof Error) throw next
        return { accountName: next }
      }),
      createTransferRecipient: vi.fn(async () => 'RCP_saved'),
    }
    const plans = { resolvePlan: async () => ({ name: 'Free', tier: 'free', maxPayoutAccounts: 3 }) }
    return { svc: new PayoutAccountService(repo as never, gateway as never, plans as never), repo, gateway, saved }
  }
  const account = { type: 'mobile_money' as const, accountNumber: '0241234567', bankCode: 'MTN' }

  it('matches a surname-first, diacritic-folded registration on first add', async () => {
    const { svc } = service(['MENSAH KWAME OSEI'])
    expect((await svc.add('owner', { ...account, accountName: 'Kwame Ɔsei Mensah' })).verificationStatus).toBe('name_matched')
  })

  it('re-resolves an unmatched account when it is added again with a corrected name', async () => {
    const { svc, repo, gateway, saved } = service(['KOFI MENSAH', 'KOFI MENSAH'])
    const first = await svc.add('owner', { ...account, accountName: 'Kwame Mensah' })
    expect(first.verificationStatus).toBe('needs_review')
    const corrected = await svc.add('owner', { ...account, accountName: 'Kofi Mensah' })
    expect(corrected).toMatchObject({ id: first.id, recipientCode: 'RCP_saved', accountName: 'Kofi Mensah', verificationStatus: 'name_matched' })
    expect(gateway.resolveAccount).toHaveBeenCalledTimes(2)
    expect(gateway.createTransferRecipient).toHaveBeenCalledOnce()
    expect(repo.updateVerification).toHaveBeenCalledOnce()
    expect(saved).toHaveLength(1)
  })

  it('keeps a matched account as it is and never downgrades it on re-add', async () => {
    const { svc, repo, gateway } = service(['KWAME MENSAH'])
    await svc.add('owner', { ...account, accountName: 'Kwame Mensah' })
    const again = await svc.add('owner', { ...account, accountName: 'Somebody Else' })
    expect(again.verificationStatus).toBe('name_matched')
    expect(again.accountName).toBe('Kwame Mensah')
    expect(gateway.resolveAccount).toHaveBeenCalledOnce()
    expect(repo.updateVerification).not.toHaveBeenCalled()
  })

  it('falls back to the provider name it already returned when a re-check lookup fails', async () => {
    const { svc } = service(['KOFI MENSAH', new Error('provider unavailable')])
    await svc.add('owner', { ...account, accountName: 'Kwame Mensah' })
    const corrected = await svc.add('owner', { ...account, accountName: 'Mensah Kofi' })
    expect(corrected).toMatchObject({ verificationStatus: 'name_matched', resolvedAccountName: 'KOFI MENSAH' })
  })
})
