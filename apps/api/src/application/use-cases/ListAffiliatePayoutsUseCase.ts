import type { AffiliatePayout } from '@ubuntu-fund/types';
import type { AffiliatePayoutRepositoryPort } from '../../domain/ports/outbound/AffiliatePayoutRepositoryPort.js';
import { toAffiliatePayoutDto } from './mappers/affiliateDto.js';

/** List every affiliate payout across the platform, newest first (admin console). */
export class ListAffiliatePayoutsUseCase {
  constructor(
    private readonly affiliatePayoutRepo: AffiliatePayoutRepositoryPort
  ) {}

  async execute(): Promise<AffiliatePayout[]> {
    const payouts = await this.affiliatePayoutRepo.findAll();
    return payouts.map(toAffiliatePayoutDto);
  }
}
