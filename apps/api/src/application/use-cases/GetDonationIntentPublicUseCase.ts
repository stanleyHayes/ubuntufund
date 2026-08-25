import type { DonationIntentPublicView } from '@ubuntu-fund/types';
import type { DonationIntentEntity } from '../../domain/entities/DonationIntent.js';
import type { DonationIntentRepositoryPort } from '../../domain/ports/outbound/DonationIntentRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** Public projection of an intent — omits the idempotency key and donor PII. */
export function toDonationIntentPublicView(
  intent: DonationIntentEntity
): DonationIntentPublicView {
  return {
    id: intent.id,
    campaignId: intent.campaignId,
    liveSessionId: intent.liveSessionId,
    amount: intent.amount,
    tip: intent.tip,
    currency: intent.currency,
    status: intent.status,
    provider: intent.provider,
    isAnonymous: intent.isAnonymous,
    createdAt: intent.createdAt,
    updatedAt: intent.updatedAt,
  };
}

/**
 * Status polling for a donation intent (`GET /donation-intents/:id/public`).
 * Guests poll this after a hosted-payment redirect to watch CREATED → PENDING
 * → SUCCEEDED/FAILED.
 */
export class GetDonationIntentPublicUseCase {
  constructor(
    private readonly donationIntentRepo: DonationIntentRepositoryPort
  ) {}

  async execute(id: string): Promise<DonationIntentPublicView> {
    const intent = await this.donationIntentRepo.findById(id);
    if (!intent) {
      throw new AppError('Donation intent not found', 404);
    }
    return toDonationIntentPublicView(intent);
  }
}
