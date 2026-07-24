import type {
  DisputeRepositoryPort,
  DisputeRecord,
} from '../../domain/ports/outbound/DisputeRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

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
