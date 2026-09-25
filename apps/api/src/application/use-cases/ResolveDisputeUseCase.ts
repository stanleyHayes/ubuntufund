import type {
  DisputeRepositoryPort,
  DisputeRecord,
} from '../../domain/ports/outbound/DisputeRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { providerCaseKind } from './GetDisputeUseCase.js';

export interface ResolveDisputeInput {
  /** Defaults to 'resolved' when omitted. */
  status?: 'resolved' | 'dismissed';
  resolution: string;
}

export class ResolveDisputeUseCase {
  constructor(private readonly disputeRepo: DisputeRepositoryPort) {}

  async execute(
    disputeId: string,
    input: ResolveDisputeInput,
    adminId: string
  ): Promise<DisputeRecord> {
    const existing = await this.disputeRepo.findById(disputeId);
    if (!existing) {
      throw new AppError('Dispute not found', 404);
    }

    if (existing.status === 'resolved' || existing.status === 'dismissed') {
      throw new AppError('Dispute has already been resolved', 409);
    }

    // Closing a provider case resumes automatic payouts. When the provider has
    // returned money to the donor (a dashboard refund, or a chargeback the
    // merchant accepted), 'resolved' first needs the reversal recorded, so
    // payouts never resume on a balance that still includes it. 'dismissed'
    // stays available with a note (e.g. a manual clawback handled by finance).
    const kind = providerCaseKind(existing);
    const moneyReturned = kind === 'external_refund' ||
      (kind === 'chargeback' && existing.providerResolution === 'merchant-accepted');
    if ((input.status ?? 'resolved') === 'resolved' && moneyReturned && existing.donationIntentId && !existing.reversalOperationId) {
      throw new AppError(
        'Record the provider reversal on this case before resolving it, or dismiss it with a note explaining the manual adjustment',
        409
      );
    }

    const updated = await this.disputeRepo.updateStatus(disputeId, {
      status: input.status ?? 'resolved',
      resolution: input.resolution,
      resolvedBy: adminId,
    });

    if (!updated) {
      throw new AppError('Dispute not found', 404);
    }

    return updated;
  }
}
