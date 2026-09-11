import { describe, expect, it, vi } from 'vitest'
import { RequestPayoutUseCase } from '../../../src/application/use-cases/RequestPayoutUseCase.js'
import { ApprovePayoutUseCase } from '../../../src/application/use-cases/ApprovePayoutUseCase.js'
import { RequestCreatorWithdrawalUseCase } from '../../../src/application/use-cases/RequestCreatorWithdrawalUseCase.js'
import { PayoutEntity } from '../../../src/domain/entities/Payout.js'
const key = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const cfg = {
  earlyFeePercent: 3,
  earlyMinFee: 20,
  urgentFeePercent: 4,
  urgentMinFee: 20,
  earlyMaxWithdrawalPercent: 80,
  dualApprovalAmount: 500,
}
const campaign = {
  id: 'campaign',
  creatorId: 'owner',
  endDate: new Date(Date.now() + 86400000),
  raisedAmount: { amount: 100 },
  goalAmount: { amount: 1000 },
}
function requestSetup() {
  const recipients = { findLatestByCampaignId: vi.fn() }
  const payouts = {
    findByProviderRef: vi.fn(async () => null),
    findByRequestKey: vi.fn(async () => null),
    create: vi.fn(async (p) => p),
  }
  const balances = {
    findByCampaignId: async () => ({ availableBalance: 1000, pendingBalance: 0, currency: 'GHS' }),
    clearPendingToAvailable: vi.fn(),
  }
  const uc = new RequestPayoutUseCase(
    { findById: async () => campaign } as never,
    recipients as never,
    payouts as never,
    balances as never,
    { isConfigured: () => false } as never,
    cfg as never,
  )
  return { uc, recipients, payouts }
}
describe('wallet payout policy', () => {
  it('binds wallet to owner and charges the early fee without registering a provider account', async () => {
    const { uc, recipients } = requestSetup()
    const p = await uc.execute(
      'campaign',
      { amount: 100, type: 'early', destination: 'ujimora_wallet', idempotencyKey: key },
      { userId: 'owner' },
    )
    expect(p).toMatchObject({
      recipientId: 'wallet:owner',
      provider: 'ujimora_wallet',
      status: 'PENDING',
      fee: 20,
      netAmount: 80,
    })
    expect(recipients.findLatestByCampaignId).not.toHaveBeenCalled()
  })
  it.each(['standard', 'priority', 'assisted'])(
    'wallet destination cannot bypass early policy with %s',
    async (type) => {
      const { uc, payouts } = requestSetup()
      await expect(
        uc.execute(
          'campaign',
          { amount: 100, type: type as never, destination: 'ujimora_wallet', idempotencyKey: key },
          { userId: 'owner' },
        ),
      ).rejects.toMatchObject({ statusCode: 422 })
      expect(payouts.create).not.toHaveBeenCalled()
    },
  )
  it('enforces owner access and early reserve cap', async () => {
    const { uc } = requestSetup()
    await expect(
      uc.execute(
        'campaign',
        { amount: 100, type: 'early', destination: 'ujimora_wallet', idempotencyKey: key },
        { userId: 'other' },
      ),
    ).rejects.toMatchObject({ statusCode: 403 })
    await expect(
      uc.execute(
        'campaign',
        { amount: 900, type: 'early', destination: 'ujimora_wallet', idempotencyKey: key },
        { userId: 'owner' },
      ),
    ).rejects.toMatchObject({ statusCode: 422 })
  })
  it('keeps dual approval and review required before a wallet credit', async () => {
    const p = new PayoutEntity({
      id: 'payout',
      campaignId: 'campaign',
      recipientId: 'wallet:owner',
      provider: 'ujimora_wallet',
      amount: 600,
      fee: 20,
      netAmount: 580,
      type: 'early',
      currency: 'GHS',
      status: 'PENDING',
      requestedBy: 'owner',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const payouts = { findById: async () => p, recordFirstApproval: vi.fn(async () => p) }
    const wallet = { settleCampaign: vi.fn(), recordCampaignReview: vi.fn() }
    const uc = new ApprovePayoutUseCase(
      payouts as never,
      {} as never,
      {} as never,
      { isConfigured: () => false } as never,
      cfg as never,
      { findById: async () => campaign } as never,
      wallet,
    )
    await expect(uc.execute('payout', { userId: 'admin', role: 'admin' })).rejects.toMatchObject({
      statusCode: 422,
    })
    await uc.execute(
      'payout',
      { userId: 'admin', role: 'admin' },
      'Confirmed campaign owner and eligible proceeds',
    )
    expect(payouts.recordFirstApproval).toHaveBeenCalled()
    expect(wallet.recordCampaignReview).toHaveBeenCalled()
    expect(wallet.settleCampaign).not.toHaveBeenCalled()
  })
  it('creator wallet transfers retain plan fee and reject stale fee consent', async () => {
    const wallet = {
      transferCreator: vi.fn(async (i) => ({ ...i, id: 'p', status: 'PAID', currency: 'GHS' })),
      settleCampaign: vi.fn(),
      recordCampaignReview: vi.fn(),
    }
    const accounts = { add: vi.fn() }
    const uc = new RequestCreatorWithdrawalUseCase(
      { findByRequestKey: async () => null } as never,
      { findByUserId: async () => ({ currency: 'GHS' }) } as never,
      { isConfigured: () => false } as never,
      { creatorPolicy: async () => ({ feePercent: 5 }) } as never,
      accounts as never,
      wallet as never,
    )
    await expect(
      uc.execute('owner', {
        amount: 100,
        expectedFeePercent: 0,
        destination: 'ujimora_wallet',
        idempotencyKey: key,
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
    await uc.execute('owner', {
      amount: 100,
      expectedFeePercent: 5,
      destination: 'ujimora_wallet',
      idempotencyKey: key,
    })
    expect(wallet.transferCreator).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'owner', amount: 100, fee: 5, netAmount: 95 }),
    )
    expect(accounts.add).not.toHaveBeenCalled()
  })
})
