import type { AffiliatePayout } from '@ubuntu-fund/types';
import type { AffiliatePayoutRepositoryPort } from '../../domain/ports/outbound/AffiliatePayoutRepositoryPort.js';
import type { AffiliateBalanceRepositoryPort } from '../../domain/ports/outbound/AffiliateBalanceRepositoryPort.js';
import type { AffiliateCommissionRepositoryPort } from '../../domain/ports/outbound/AffiliateCommissionRepositoryPort.js';
import type { PayoutClosureTransactionPort } from '../../domain/ports/outbound/PayoutClosureTransactionPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { toAffiliatePayoutDto } from './mappers/affiliateDto.js';
import type { AffiliatePayoutApprover } from './ApproveAffiliatePayoutUseCase.js';

/**
 * ADMIN rejects a PENDING affiliate payout. Unlike a campaign payout, an
 * affiliate request RESERVES its funds (available → in-transit) when it is
 * made, so a request that could never be approved — a suspended affiliate, a
 * bad destination — used to strand them. Rejection moves PENDING → FAILED,
 * returns the reservation under the same settleRef the webhook and repair use
 * (`aff:<id>:returned`, so it lands exactly once), flags the settlement
 * applied, releases the commissions the payout would have paid and audits the
 * reason — all in one transaction behind a current-admin fence.
 */
export class RejectAffiliatePayoutUseCase {
  constructor(
    private readonly payoutRepo: AffiliatePayoutRepositoryPort,
    private readonly balanceRepo: AffiliateBalanceRepositoryPort,
    private readonly commissionRepo: Pick<AffiliateCommissionRepositoryPort, 'releaseFromPayout'>,
    private readonly transaction: PayoutClosureTransactionPort
  ) {}

  async execute(payoutId: string, approver: AffiliatePayoutApprover, reason: string): Promise<AffiliatePayout> {
    if (approver.role !== 'admin') throw new AppError('Only an admin can reject a payout', 403);
    const trimmed = (reason ?? '').trim();
    if (trimmed.length < 20) throw new AppError('Record why the payout is rejected (at least 20 characters).', 422);
    if (!this.payoutRepo.transitionPendingToFailed) throw new AppError('Payout review is unavailable.', 503);
    const payout = await this.payoutRepo.findById(payoutId);
    if (!payout) throw new AppError('Payout not found', 404);

    const rejected = await this.transaction.run(
      approver,
      { kind: 'rejected', payoutId: payout.id, reason: trimmed, rail: 'affiliate' },
      async () => {
        const failed = await this.payoutRepo.transitionPendingToFailed!(payout.id);
        if (!failed) throw new AppError('Payout is no longer pending; refresh before trying again.', 409);
        const balance = await this.balanceRepo.findByAffiliateId(failed.affiliateId);
        if (!balance) throw new AppError('Affiliate balance not found; the payout cannot be released.', 409);
        await this.balanceRepo.returnToAvailable(balance.id, failed.amount, `aff:${failed.id}:returned`);
        await this.payoutRepo.markSettlementApplied(failed.id, 'FAILED');
        await this.commissionRepo.releaseFromPayout?.(failed.id);
        return failed;
      }
    );
    return toAffiliatePayoutDto(rejected);
  }
}
