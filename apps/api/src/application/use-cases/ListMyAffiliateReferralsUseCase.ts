import type { AffiliateReferral } from '@ubuntu-fund/types';
import type { AffiliateRepositoryPort } from '../../domain/ports/outbound/AffiliateRepositoryPort.js';
import type { AffiliateReferralRepositoryPort } from '../../domain/ports/outbound/AffiliateReferralRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** List the current user's referred signups, newest first. */
export class ListMyAffiliateReferralsUseCase {
  constructor(
    private readonly affiliateRepo: AffiliateRepositoryPort,
    private readonly affiliateReferralRepo: AffiliateReferralRepositoryPort
  ) {}

  async execute(userId: string): Promise<AffiliateReferral[]> {
    const affiliate = await this.affiliateRepo.findByUserId(userId);
    if (!affiliate) {
      throw new AppError('Not enrolled in the affiliate program', 404);
    }
    return this.affiliateReferralRepo.findByReferrerId(affiliate.id);
  }
}
