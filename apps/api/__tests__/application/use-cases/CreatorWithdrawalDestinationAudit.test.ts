import { describe, expect, it, vi } from 'vitest'
import { RequestCreatorWithdrawalUseCase } from '../../../src/application/use-cases/RequestCreatorWithdrawalUseCase.js'

const key = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

function setup(legalName: string | undefined) {
  const account = {
    id: 'saved-1', type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw',
    resolvedAccountName: 'WITH DRAW', verificationStatus: 'name_matched', recipientCode: 'RCP_saved',
  }
  const audit = { record: vi.fn(async () => {}) }
  const transfer = vi.fn(async () => ({ status: 'pending', transferCode: 'TRF_1' }))
  const uc = new RequestCreatorWithdrawalUseCase(
    {
      findByRequestKey: async () => null,
      create: async () => ({ id: 'cp-1' }),
      transitionToProcessing: async () => ({ id: 'cp-1' }),
      attachTransferDetails: async () => {},
    } as never,
    { findByUserId: async () => ({ currency: 'GHS' }), reserveForPayout: async () => ({ currency: 'GHS' }) } as never,
    { isConfigured: () => true, getBalance: async () => [{ currency: 'GHS', balance: 1_000_000 }], initiateTransfer: transfer } as never,
    { creatorPolicy: async () => ({ feePercent: 3 }) } as never,
    { add: async () => account, assertCurrent: async () => {} } as never,
    undefined,
    { run: (_userId: string, _authVersion: string, work: () => Promise<unknown>) => work() } as never,
    { assertOwnerVerified: async () => {}, verifiedLegalName: async () => legalName },
    audit,
  )
  const withdraw = () => uc.execute('creator-1', {
    amount: 100, expectedFeePercent: 3, idempotencyKey: key,
    recipient: { type: 'mobile_money', accountNumber: '0551234567', bankCode: 'MTN', accountName: 'With Draw' },
  } as never)
  return { withdraw, audit, transfer }
}

describe('creator withdrawal destination ownership audit', () => {
  it('records a withdrawal to an account held under a name other than the verified legal name, without blocking it', async () => {
    const { withdraw, audit, transfer } = setup('Kofi Boateng')
    await expect(withdraw()).resolves.toMatchObject({ status: 'PROCESSING' })
    expect(transfer).toHaveBeenCalledOnce()
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'creator_withdrawal.destination_not_legal_name', resource: 'cp-1', severity: 'warning',
    }))
  })

  it.each([
    ['the creator (surname first)', 'Draw With'],
    ['an account holder with no recorded legal name', undefined],
  ])('records nothing for %s', async (_label, legalName) => {
    const { withdraw, audit } = setup(legalName)
    await withdraw()
    expect(audit.record).not.toHaveBeenCalled()
  })
})
