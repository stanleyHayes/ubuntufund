import { randomUUID } from 'node:crypto'
import { PaymentMethod, type CreateDonationInput } from '@ubuntu-fund/types'
import type { CreateDonationIntentUseCase } from './CreateDonationIntentUseCase.js'
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js'

/** Keep the legacy endpoint, but settle through the same accounting rail as checkout. */
export class DonateToCampaignUseCase {
  constructor(private readonly intents: CreateDonationIntentUseCase) {}

  async execute(input: CreateDonationInput, donorId: string): Promise<void> {
    if (input.paymentMethod !== PaymentMethod.WALLET) {
      throw new AppError('This payment method is not available for live transactions yet', 400)
    }
    await this.intents.execute(
      {
        campaignId: input.campaignId,
        amount: input.amount,
        currency: input.currency,
        provider: 'wallet',
        tip: 0,
        message: input.message,
        isAnonymous: input.isAnonymous,
        liveSessionId: input.liveSessionId,
      },
      { donorUserId: donorId, idempotencyKey: `legacy-wallet:${donorId}:${randomUUID()}` },
    )
  }
}
