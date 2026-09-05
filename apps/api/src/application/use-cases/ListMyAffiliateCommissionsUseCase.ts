import type { AffiliateCommission } from '@ubuntu-fund/types';
import type { AffiliateRepositoryPort } from '../../domain/ports/outbound/AffiliateRepositoryPort.js';
import type { AffiliateCommissionRepositoryPort } from '../../domain/ports/outbound/AffiliateCommissionRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { toAffiliateCommissionDto } from './mappers/affiliateDto.js';

/** List the current user's earned commissions, newest first. */
export class ListMyAffiliateCommissionsUseCase {
  constructor(
    private readonly affiliateRepo: AffiliateRepositoryPort,
    private readonly affiliateCommissionRepo: AffiliateCommissionRepositoryPort
  ) {}

  async execute(userId: string): Promise<AffiliateCommission[]> {
    const affiliate = await this.affiliateRepo.findByUserId(userId);
    if (!affiliate) {
      throw new AppError('Not enrolled in the affiliate program', 404);
    }
    const commissions = await this.affiliateCommissionRepo.findByAffiliateId(
      affiliate.id
    );
    return commissions.map(toAffiliateCommissionDto);
  }
}
