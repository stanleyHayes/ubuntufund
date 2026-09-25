import type { AffiliateCommission } from '@ubuntu-fund/types';
import type { AffiliateCommissionRepositoryPort } from '../../domain/ports/outbound/AffiliateCommissionRepositoryPort.js';
import type { AffiliateBalanceRepositoryPort } from '../../domain/ports/outbound/AffiliateBalanceRepositoryPort.js';
import { toAffiliateCommissionDto } from './mappers/affiliateDto.js';
import type { UnitOfWorkPort } from '../../domain/ports/outbound/UnitOfWorkPort.js';
import { AffiliateCommissionMaturity } from '../services/AffiliateCommissionMaturity.js';

/**
 * Batch maturity sweep, run by the scheduled reconciliation timer: matures
 * every held commission whose hold window has elapsed, exactly once each (see
 * {@link AffiliateCommissionMaturity}). Returns the commissions matured.
 */
export class MatureAffiliateCommissionsUseCase {
  private readonly maturity: AffiliateCommissionMaturity

  constructor(
    affiliateCommissionRepo: AffiliateCommissionRepositoryPort,
    affiliateBalanceRepo: AffiliateBalanceRepositoryPort,
    unitOfWork?: UnitOfWorkPort
  ) {
    this.maturity = new AffiliateCommissionMaturity(affiliateCommissionRepo, affiliateBalanceRepo, unitOfWork)
  }

  async execute(now: Date = new Date()): Promise<AffiliateCommission[]> {
    return (await this.maturity.mature(now)).map(toAffiliateCommissionDto)
  }
}
