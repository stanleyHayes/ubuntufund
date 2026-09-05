import type { Affiliate } from '@ubuntu-fund/types';
import type { AffiliateRepositoryPort } from '../../domain/ports/outbound/AffiliateRepositoryPort.js';

/** List every affiliate across the platform, newest first (admin console). */
export class ListAffiliatesUseCase {
  constructor(private readonly affiliateRepo: AffiliateRepositoryPort) {}

  async execute(): Promise<Affiliate[]> {
    return this.affiliateRepo.findAll();
  }
}
