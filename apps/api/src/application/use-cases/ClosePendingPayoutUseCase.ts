import type { Payout } from '@ubuntu-fund/types'
import type { PayoutRepositoryPort } from '../../domain/ports/outbound/PayoutRepositoryPort.js'
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js'
import type { CampaignBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBalanceRepositoryPort.js'
import type { PayoutClosureTransactionPort } from '../../domain/ports/outbound/PayoutClosureTransactionPort.js'
import type { CouponRepositoryPort } from '../../domain/ports/outbound/CouponRepositoryPort.js'
import type { CouponRedemptionRepositoryPort } from '../../domain/ports/outbound/CouponRedemptionRepositoryPort.js'
import { roundToCurrency } from '../../domain/value-objects/Money.js'
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js'
import { toPayoutDto } from './mappers/payoutDto.js'
import type { PayoutRequester } from './CreatePayoutRecipientUseCase.js'

/** Minimum length of an admin rejection reason (it is shown to the owner). */
export const PAYOUT_REJECTION_REASON_MIN = 20

/**
 * Close a PENDING campaign payout before any transfer: an admin REJECTS it
 * (with a reason the owner sees) or the campaign owner CANCELS their own
 * request. A PENDING payout never reserved money, so closing it only undoes the
 * request's own clearing step — the amount it moved pending → available goes
 * back to pending (bounded by what is still available), which is what lets a
 * refund draw on those funds again. A PAYOUT_FEE coupon the request used is
 * freed too (its per-user seat and its global count), because nothing was
 * paid out. One transaction commits the terminal status, the balance move, the
 * coupon release and the audit entry; a replay finds the payout no longer
 * PENDING and changes nothing.
 */
export class ClosePendingPayoutUseCase {
  constructor(
    private readonly payoutRepo: PayoutRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly campaignBalanceRepo: CampaignBalanceRepositoryPort,
    private readonly transaction: PayoutClosureTransactionPort,
    private readonly coupons?: {
      redemptions: Pick<CouponRedemptionRepositoryPort, 'releaseConsumed'>
      coupons: Pick<CouponRepositoryPort, 'decrementRedemption'>
    },
  ) {}

  /** Admin: reject a PENDING payout with a reason recorded for the owner. */
  async reject(payoutId: string, requester: PayoutRequester, reason: string): Promise<Payout> {
    if (requester.role !== 'admin') throw new AppError('Only an admin can reject a payout', 403)
    const trimmed = (reason ?? '').trim()
    if (trimmed.length < PAYOUT_REJECTION_REASON_MIN)
      throw new AppError(
        `Give the owner a reason for the rejection (at least ${PAYOUT_REJECTION_REASON_MIN} characters).`,
        422,
      )
    const payout = await this.payoutRepo.findById(payoutId)
    if (!payout) throw new AppError('Payout not found', 404)
    return this.close(payout.id, requester, 'rejected', trimmed)
  }

  /** Owner: cancel their own campaign's PENDING payout request. */
  async cancel(
    campaignId: string,
    payoutId: string,
    requester: PayoutRequester,
    reason?: string,
  ): Promise<Payout> {
    const payout = await this.payoutRepo.findById(payoutId)
    // Same 404 for a payout on another campaign: never confirm it exists.
    if (!payout || payout.campaignId !== campaignId) throw new AppError('Payout not found', 404)
    const campaign = await this.campaignRepo.findById(campaignId)
    if (!campaign || campaign.creatorId !== requester.userId)
      throw new AppError('Only the campaign owner can cancel this payout request', 403)
    return this.close(payout.id, requester, 'cancelled', reason?.trim() || 'Cancelled by the campaign owner.')
  }

  private async close(
    payoutId: string,
    requester: PayoutRequester,
    kind: 'rejected' | 'cancelled',
    reason: string,
  ): Promise<Payout> {
    if (!this.payoutRepo.closePending) throw new AppError('Payout review is unavailable.', 503)
    const closed = await this.transaction.run(requester, { kind, payoutId, reason }, async () => {
      const current = await this.payoutRepo.closePending!(payoutId, {
        kind,
        reason,
        closedBy: requester.userId,
        closedAt: new Date(),
      })
      if (!current) throw new AppError('Payout is no longer pending; refresh before trying again.', 409)
      const balance = await this.campaignBalanceRepo.findByCampaignId(current.campaignId)
      const available = balance?.availableBalance ?? 0
      // A request made before clearedAmount was recorded still cleared its
      // shortfall pending → available. Return what the campaign's other PENDING
      // requests do not rely on, so refunds can reach it again.
      const cleared = current.clearedAmount ?? Math.max(
        0,
        Math.min(
          current.amount,
          available - ((await this.payoutRepo.sumPendingAmount?.(current.campaignId, current.id)) ?? 0),
        ),
      )
      if (cleared > 0) {
        // Another payout may have been approved out of `available` since this
        // request cleared it; return only what is still there.
        const back = roundToCurrency(Math.min(cleared, available), current.currency)
        if (back > 0 && !(await this.campaignBalanceRepo.returnAvailableToPending(current.campaignId, back)))
          throw new AppError('Campaign balance changed; try again.', 409)
      }
      // Nothing was paid out, so the fee coupon the request used is not spent.
      if (current.couponRedemptionId && this.coupons?.redemptions.releaseConsumed) {
        const released = await this.coupons.redemptions.releaseConsumed(current.couponRedemptionId)
        if (released && current.couponId) await this.coupons.coupons.decrementRedemption?.(current.couponId)
      }
      return current
    })
    return toPayoutDto(closed)
  }
}
