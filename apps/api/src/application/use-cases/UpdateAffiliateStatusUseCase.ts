import {
  AffiliateStatus,
  type Affiliate,
  type UpdateAffiliateStatusInput,
} from '@ubuntu-fund/types';
import type { AffiliateRepositoryPort } from '../../domain/ports/outbound/AffiliateRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/**
 * ADMIN activates or suspends an affiliate. A suspended affiliate accrues no new
 * commission (enforced in AffiliateCommissionService); existing balances and
 * payouts are unaffected.
 */
export class UpdateAffiliateStatusUseCase {
  constructor(private readonly affiliateRepo: AffiliateRepositoryPort) {}

  async execute(
    affiliateId: string,
    input: UpdateAffiliateStatusInput
  ): Promise<Affiliate> {
    if (!Object.values(AffiliateStatus).includes(input.status)) {
      throw new AppError('Invalid affiliate status', 422);
    }

    const affiliate = await this.affiliateRepo.findById(affiliateId);
    if (!affiliate) {
      throw new AppError('Affiliate not found', 404);
    }

    const updated = await this.affiliateRepo.update({
      ...affiliate,
      status: input.status,
    });
    if (!updated) {
      throw new AppError('Affiliate not found', 404);
    }

    return updated;
  }
}
