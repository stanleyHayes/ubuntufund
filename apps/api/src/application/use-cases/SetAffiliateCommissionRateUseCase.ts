import type {
  Affiliate,
  SetAffiliateCommissionRateInput,
} from '@ubuntu-fund/types';
import type { AffiliateRepositoryPort } from '../../domain/ports/outbound/AffiliateRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/**
 * ADMIN overrides an affiliate's per-affiliate commission rate (a percentage
 * 0..100). A rate of 0 restores the platform default at accrual time.
 */
export class SetAffiliateCommissionRateUseCase {
  constructor(private readonly affiliateRepo: AffiliateRepositoryPort) {}

  async execute(
    affiliateId: string,
    input: SetAffiliateCommissionRateInput
  ): Promise<Affiliate> {
    const rate = Number(input.commissionRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new AppError('commissionRate must be between 0 and 100', 422);
    }

    const affiliate = await this.affiliateRepo.findById(affiliateId);
    if (!affiliate) {
      throw new AppError('Affiliate not found', 404);
    }

    const updated = await this.affiliateRepo.update({
      ...affiliate,
      commissionRate: rate,
    });
    if (!updated) {
      throw new AppError('Affiliate not found', 404);
    }

    return updated;
  }
}
