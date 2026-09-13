import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type { LedgerRepositoryPort } from '../../domain/ports/outbound/LedgerRepositoryPort.js';
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
    private readonly donationIntentRepo: DonationIntentRepositoryPort,
    private readonly ledger: LedgerRepositoryPort,
    private readonly donations: DonationRepositoryPort
  ) {}

  async execute(id: string): Promise<DonationIntentPublicView> {
    const intent = await this.donationIntentRepo.findById(id);
    if (!intent) {
      throw new AppError('Donation intent not found', 404);
    }
    const view = toDonationIntentPublicView(intent);
    if (intent.status !== 'SUCCEEDED') return view;
    const entry = await this.ledger.findEntryByDonationIntentId(intent.id);
    const donation = entry?.donationId ? await this.donations.findById(entry.donationId) : null;
    if (!donation || donation.campaignId !== intent.campaignId || donation.donorId !== (intent.donorUserId ?? 'guest')) {
      return { ...view, contentReviewStatus: 'unavailable' };
    }
    const content = donation.toPlain();
    const requested = !content.publicContentRevokedAt && ((!content.isAnonymous && !!content.donorName?.trim()) || (!content.messageHiddenAt && !!content.message?.trim()));
    return { ...view, contentReviewStatus: !requested ? 'not_requested' : donation.publicContentApproved ? 'approved' : content.publicContentStatus === 'rejected' ? 'rejected' : 'pending' };

  }
}
