import { randomUUID } from 'node:crypto'
import { PaymentMethod, type CreateDonationInput } from '@ubuntu-fund/types'
import type { CreateDonationIntentUseCase } from './CreateDonationIntentUseCase.js'
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js'
import { toMinorUnits } from '../../domain/value-objects/Money.js'

/** A client-chosen request key: 8-100 URL-safe characters (a UUID fits). */
export const WALLET_REQUEST_KEY = /^[A-Za-z0-9_-]{8,100}$/

/** Keep the legacy endpoint, but settle through the same accounting rail as checkout. */
export class DonateToCampaignUseCase {
  constructor(private readonly intents: CreateDonationIntentUseCase) {}

  /**
   * `requestKey` is the client's Idempotency-Key for this donation attempt. A
   * retry after a lost response (gateway timeout, cold start) with the same key
   * resolves to the same intent and never debits the wallet twice. Without a
   * key every call is a new donation, as before.
   */
  async execute(input: CreateDonationInput, donorId: string, requestKey?: string): Promise<void> {
    if (input.paymentMethod !== PaymentMethod.WALLET) {
      throw new AppError('This payment method is not available for live transactions yet', 400)
    }
    if (requestKey !== undefined && !WALLET_REQUEST_KEY.test(requestKey)) {
      throw new AppError('Invalid Idempotency-Key', 400)
    }
    const { intent } = await this.intents.execute(
      {
        campaignId: input.campaignId,
        amount: input.amount,
        currency: input.currency,
        provider: 'wallet',
        tip: 0,
        donorName: input.isAnonymous ? undefined : input.donorName?.trim(),
        message: input.message,
        legalAcceptance: input.legalAcceptance,
        isAnonymous: input.isAnonymous,
        liveSessionId: input.liveSessionId,
      },
      // Scoped per donor, so one account's key can never address another's.
      { donorUserId: donorId, idempotencyKey: `legacy-wallet:${donorId}:${requestKey ?? randomUUID()}` },
    )
    // A reused key resolves to the donation it was first used for; never
    // report that one as a different donation the client is asking for now.
    if (intent && (intent.campaignId !== input.campaignId ||
        toMinorUnits(intent.amount, intent.currency) !== toMinorUnits(input.amount, intent.currency))) {
      throw new AppError('This request key was already used for a different donation', 409)
    }
    // A replay of an attempt that did not complete (e.g. refused for low
    // balance) must not be reported as a successful donation.
    if (intent?.status !== 'SUCCEEDED') {
      throw new AppError('This donation attempt did not go through. Please start a new donation.', 409)
    }
  }
}
