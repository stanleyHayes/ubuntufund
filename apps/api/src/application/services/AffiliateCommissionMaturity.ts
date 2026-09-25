import type { AffiliateCommissionEntity } from '../../domain/entities/AffiliateCommission.js'
import type { AffiliateCommissionRepositoryPort } from '../../domain/ports/outbound/AffiliateCommissionRepositoryPort.js'
import type { AffiliateBalanceRepositoryPort } from '../../domain/ports/outbound/AffiliateBalanceRepositoryPort.js'
import type { UnitOfWorkPort } from '../../domain/ports/outbound/UnitOfWorkPort.js'
import { logger } from '../../infrastructure/logging/logger.js'

class MaturityShortfall extends Error {}

/**
 * Move held commissions whose hold window has elapsed to available — exactly
 * once each. The commission is CLAIMED first (held → available, a guarded
 * atomic transition) and only the winner clears its amount pending →
 * available. The old order (clear the balance, then write the status) let two
 * concurrent runs clear the same commission twice, pulling other, still-held
 * commissions' money into available before their clawback window ended, and let
 * a concurrent refund's "reversed" be overwritten. With a unit of work both
 * writes commit together; without one, a failed clear releases the claim.
 */
export class AffiliateCommissionMaturity {
  constructor(
    private readonly commissions: AffiliateCommissionRepositoryPort,
    private readonly balances: AffiliateBalanceRepositoryPort,
    private readonly unitOfWork?: UnitOfWorkPort,
  ) {}

  /** Mature due commissions — one affiliate's when `affiliateId` is given. */
  async mature(now: Date = new Date(), affiliateId?: string): Promise<AffiliateCommissionEntity[]> {
    const due = await this.commissions.findMaturedHeld(now, affiliateId)
    const balanceIds = new Map<string, string | null>()
    const matured: AffiliateCommissionEntity[] = []
    for (const commission of due) {
      if (affiliateId && commission.affiliateId !== affiliateId) continue
      let balanceId = balanceIds.get(commission.affiliateId)
      if (balanceId === undefined) {
        balanceId = (await this.balances.findByAffiliateId(commission.affiliateId))?.id ?? null
        balanceIds.set(commission.affiliateId, balanceId)
      }
      if (!balanceId) continue
      try {
        if (await this.matureOne(commission, balanceId)) {
          commission.markAvailable()
          matured.push(commission)
        }
      } catch (error) {
        logger.error(
          { error, commissionId: commission.id, affiliateId: commission.affiliateId },
          'affiliate commission maturity failed; it stays held and is retried next run',
        )
      }
    }
    return matured
  }

  private async matureOne(commission: AffiliateCommissionEntity, balanceId: string): Promise<boolean> {
    const work = async () => {
      const claimed = await this.commissions.transitionStatus(commission.id, 'held', 'available')
      if (!claimed) return false // another run, or a refund, got there first
      if (!(await this.balances.clearPendingToAvailable(balanceId, commission.amount)))
        throw new MaturityShortfall('Pending balance does not cover this commission')
      return true
    }
    if (this.unitOfWork) return this.unitOfWork.run(work)
    try {
      return await work()
    } catch (error) {
      if (error instanceof MaturityShortfall)
        await this.commissions.transitionStatus(commission.id, 'available', 'held')
      throw error
    }
  }
}
