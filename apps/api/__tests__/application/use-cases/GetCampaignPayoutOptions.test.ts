import { describe, expect, it, vi } from 'vitest'
import { GetCampaignPayoutOptionsUseCase } from '../../../src/application/use-cases/GetCampaignPayoutOptionsUseCase.js'
describe('cashout options', () => {
  const balances = {
    findByCampaignId: vi.fn(async () => ({
      totalRaised: 110,
      platformFees: 5,
      processorFees: 5,
      paidOutBalance: 0,
      payoutFees: 0,
      pendingBalance: 90,
      availableBalance: 10,
      currency: 'GHS',
    })),
  }
  const recipients = {
    findLatestByCampaignId: vi.fn(async () => ({
      accountName: 'Owner',
      accountNumber: '0241234567',
      type: 'mobile_money',
      toPlain: () => ({}),
    })),
  }
  const uc = new GetCampaignPayoutOptionsUseCase(
    {
      findById: async () => ({
        creatorId: 'owner',
        endDate: new Date(0),
        raisedAmount: { amount: 100 },
        goalAmount: { amount: 1000 },
      }),
    } as never,
    balances as never,
    recipients as never,
    { resolvePayoutsConfig: async () => ({ earlyMaxWithdrawalPercent: 80 }) } as never,
  )
  it('rejects a different user before disclosing account/balance details', async () => {
    await expect(uc.execute('campaign', { userId: 'other' })).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(balances.findByCampaignId).not.toHaveBeenCalled()
  })
  it('returns net eligible proceeds and only the account suffix', async () => {
    const result = await uc.execute('campaign', { userId: 'owner' })
    expect(result).toMatchObject({
      requiresEarlyCashout: false,
      eligible: 100,
      currency: 'GHS',
      fees: { earlyMaxWithdrawalPercent: 80 },
    })
    // Exhaustive, not toMatchObject: the guarantee in this test's name is about
    // what is ABSENT. toMatchObject ignores extra keys, so it passed just as
    // happily if the full accountNumber were added to the payload.
    expect(result.recipient).toEqual({
      accountName: 'Owner',
      last4: '4567',
      type: 'mobile_money',
      verificationStatus: 'needs_review',
      resolvedAccountName: undefined,
    })
  })
})

it('explains fees, paid funds and reserved amounts without deducting fees twice', async () => {
  const uc = new GetCampaignPayoutOptionsUseCase(
    {
      findById: async () => ({
        creatorId: 'owner',
        endDate: new Date(0),
        raisedAmount: { amount: 5200 },
        goalAmount: { amount: 5000 },
      }),
    } as never,
    {
      findByCampaignId: async () => ({
        totalRaised: 5200,
        platformFees: 130,
        processorFees: 101.4,
        paidOutBalance: 500,
        payoutFees: 10,
        pendingBalance: 4000,
        availableBalance: 258.6,
        currency: 'GHS',
      }),
    } as never,
    { findLatestByCampaignId: async () => null } as never,
    { resolvePayoutsConfig: async () => ({}) } as never,
  )
  const result = await uc.execute('campaign', { userId: 'owner' })
  expect(result.eligible).toBe(4258.6)
  expect(result.breakdown).toMatchObject({
    raised: 5200,
    raisedDifference: 0,
    platformFees: 130,
    processorFees: 101.4,
    netProceeds: 4968.6,
    paidOut: 500,
    payoutFees: 10,
    reservedOrAdjustments: 200,
    eligible: 4258.6,
  })
})
it('shows a missing balance projection as a discrepancy, not a fee', async () => {
  const uc = new GetCampaignPayoutOptionsUseCase(
    {
      findById: async () => ({
        creatorId: 'owner',
        endDate: new Date(0),
        raisedAmount: { amount: 5200 },
        goalAmount: { amount: 5000 },
      }),
    } as never,
    { findByCampaignId: async () => null } as never,
    { findLatestByCampaignId: async () => null } as never,
    { resolvePayoutsConfig: async () => ({}) } as never,
  )
  expect((await uc.execute('campaign', { userId: 'owner' })).breakdown).toMatchObject({
    raisedDifference: 5200,
    platformFees: 0,
    processorFees: 0,
    eligible: 0,
  })
})
