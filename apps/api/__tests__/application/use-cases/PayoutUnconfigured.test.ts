import { describe, it, expect } from 'vitest'
import { PaystackGateway } from '../../../src/infrastructure/adapters/outbound/payments/PaystackGateway.js'
import { ListBanksUseCase } from '../../../src/application/use-cases/ListBanksUseCase.js'
import { CreatePayoutRecipientUseCase } from '../../../src/application/use-cases/CreatePayoutRecipientUseCase.js'
import { RequestPayoutUseCase } from '../../../src/application/use-cases/RequestPayoutUseCase.js'
import { ApprovePayoutUseCase } from '../../../src/application/use-cases/ApprovePayoutUseCase.js'
import { AppError } from '../../../src/infrastructure/adapters/inbound/middleware/errorHandler.js'
import type { CampaignRepositoryPort } from '../../../src/domain/ports/outbound/CampaignRepositoryPort.js'
import type { TransferRecipientRepositoryPort } from '../../../src/domain/ports/outbound/TransferRecipientRepositoryPort.js'
import type { PayoutRepositoryPort } from '../../../src/domain/ports/outbound/PayoutRepositoryPort.js'
import type { CampaignBalanceRepositoryPort } from '../../../src/domain/ports/outbound/CampaignBalanceRepositoryPort.js'

/**
 * Payouts are disabled when the Paystack secret key is absent — every
 * payout-surface use-case must surface a 501 before touching any repository.
 * Built with a real, credential-less PaystackGateway so the guard is exercised
 * exactly as production would. Deterministic: no env mutation, no DB, no globals.
 */
describe('Payouts — disabled without a Paystack secret key', () => {
  const gateway = new PaystackGateway({
    secretKey: '',
    publicKey: '',
    publicWebUrl: 'http://localhost',
  })

  // The 501 guard runs first, so the repositories are never reached; unusable
  // stubs make an accidental call fail loudly rather than pass silently.
  const failRepo = new Proxy(
    {},
    {
      get() {
        throw new Error('repository must not be called when payouts are disabled')
      },
    },
  )
  const campaignRepo = failRepo as unknown as CampaignRepositoryPort
  const recipientRepo = failRepo as unknown as TransferRecipientRepositoryPort
  const payoutRepo = failRepo as unknown as PayoutRepositoryPort
  const balanceRepo = failRepo as unknown as CampaignBalanceRepositoryPort

  const requester = { userId: 'user-1', role: 'admin' }

  // A full payouts config; the 501 guard runs before any of it is read.
  const payoutsConfig = {
    priorityFeePercent: 0.5,
    priorityMinFee: 10,
    earlyFeePercent: 1.0,
    earlyMinFee: 20,
    urgentFeePercent: 1.5,
    urgentMinFee: 30,
    assistedFeePercent: 1.5,
    assistedFixedFee: 50,
    earlyMaxWithdrawalPercent: 80,
    maxTransferAmount: 50000,
    dualApprovalAmount: 0,
  }

  it('reports the gateway as not configured', () => {
    expect(gateway.isConfigured()).toBe(false)
  })

  it('ListBanks throws 501', async () => {
    const useCase = new ListBanksUseCase(gateway)
    await expect(useCase.execute('GHS')).rejects.toMatchObject({
      statusCode: 501,
    })
  })

  it('CreatePayoutRecipient throws 501', async () => {
    const useCase = new CreatePayoutRecipientUseCase(campaignRepo, recipientRepo, gateway)
    await expect(
      useCase.execute(
        'campaign-1',
        {
          type: 'mobile_money',
          accountNumber: '0551234567',
          bankCode: 'MTN',
          accountName: 'Jane Beneficiary',
        },
        requester,
      ),
    ).rejects.toMatchObject({ statusCode: 501 })
  })

  it('RequestPayout throws 501', async () => {
    const useCase = new RequestPayoutUseCase(
      campaignRepo,
      recipientRepo,
      payoutRepo,
      balanceRepo,
      gateway,
      payoutsConfig,
    )
    await expect(useCase.execute('campaign-1', { amount: 100 }, requester)).rejects.toMatchObject({
      statusCode: 501,
    })
  })

  it('ApprovePayout throws 501 for an admin', async () => {
    const useCase = new ApprovePayoutUseCase(
      { findById: async () => ({ provider: 'paystack' }) } as never,
      recipientRepo,
      balanceRepo,
      gateway,
      payoutsConfig,
    )
    await expect(useCase.execute('payout-1', requester)).rejects.toMatchObject({ statusCode: 501 })
  })

  it('the 501 is a well-formed AppError', async () => {
    const useCase = new ListBanksUseCase(gateway)
    await expect(useCase.execute('GHS')).rejects.toBeInstanceOf(AppError)
  })
})
