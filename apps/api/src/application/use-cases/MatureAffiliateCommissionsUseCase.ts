import type { AffiliateCommission } from '@ubuntu-fund/types';
import type { AffiliateCommissionRepositoryPort } from '../../domain/ports/outbound/AffiliateCommissionRepositoryPort.js';
import type { AffiliateBalanceRepositoryPort } from '../../domain/ports/outbound/AffiliateBalanceRepositoryPort.js';
import { toAffiliateCommissionDto } from './mappers/affiliateDto.js';

/**
 * Batch maturity sweep (cron): finds every held commission whose hold window has
 * elapsed and, for each, clears its funds from pending → available (guarded) and
 * transitions the commission held → available. Tying the transition to the
 * guarded balance move keeps a concurrent sweep from crediting the same
 * commission twice. Returns the commissions that were matured this run.
 */
export class MatureAffiliateCommissionsUseCase {
  constructor(
    private readonly affiliateCommissionRepo: AffiliateCommissionRepositoryPort,
    private readonly affiliateBalanceRepo: AffiliateBalanceRepositoryPort
  ) {}

  async execute(now: Date = new Date()): Promise<AffiliateCommission[]> {
    const matured = await this.affiliateCommissionRepo.findMaturedHeld(now);
    // Cache each affiliate's balance id so we resolve it once per affiliate.
    const balanceIdByAffiliate = new Map<string, string | null>();
    const cleared: AffiliateCommission[] = [];

    for (const commission of matured) {
      let balanceId = balanceIdByAffiliate.get(commission.affiliateId);
      if (balanceId === undefined) {
        const balance = await this.affiliateBalanceRepo.findByAffiliateId(
          commission.affiliateId
        );
        balanceId = balance?.id ?? null;
        balanceIdByAffiliate.set(commission.affiliateId, balanceId);
      }
      if (!balanceId) continue; // no balance row — nothing to move

      const moved = await this.affiliateBalanceRepo.clearPendingToAvailable(
        balanceId,
        commission.amount
      );
      if (!moved) continue; // already cleared (a concurrent sweep won)

      commission.markAvailable();
      await this.affiliateCommissionRepo.update(commission);
      cleared.push(toAffiliateCommissionDto(commission));
    }

    return cleared;
  }
}
