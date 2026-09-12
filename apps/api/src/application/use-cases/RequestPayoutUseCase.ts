import { CouponSurface, CouponRedemptionStatus, type Payout, type RequestPayoutInput } from '@ubuntu-fund/types'
import { PayoutEntity } from '../../domain/entities/Payout.js'
import { roundToCurrency } from '../../domain/value-objects/Money.js'
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js'
import type { TransferRecipientRepositoryPort } from '../../domain/ports/outbound/TransferRecipientRepositoryPort.js'
import type { PayoutRepositoryPort } from '../../domain/ports/outbound/PayoutRepositoryPort.js'
import type { CampaignBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBalanceRepositoryPort.js'
import type { CampaignSplitRepositoryPort } from '../../domain/ports/outbound/CampaignSplitRepositoryPort.js'
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js'
import type { CouponService } from '../services/CouponService.js'
import type { CouponRepositoryPort } from '../../domain/ports/outbound/CouponRepositoryPort.js'
import type { CouponRedemptionRepositoryPort } from '../../domain/ports/outbound/CouponRedemptionRepositoryPort.js'
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js'
import { toPayoutDto } from './mappers/payoutDto.js'
import type { PayoutRequester } from './CreatePayoutRecipientUseCase.js'
import {
  computePayoutFee,
  isEarlyWithdrawal,
  campaignNeedsEarlyCashout,
} from '../services/payoutFee.js'
import type { PayoutsConfig } from '../../infrastructure/config/index.js'

const CURRENCY = 'GHS'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Owner requests a payout of cleared funds. Creates a PENDING payout awaiting
 * ADMIN approval — no money moves and no transfer is initiated here.
 *
 * CLEARING RULE (documented): a settled donation's beneficiary-net is
 * immediately eligible for payout — there is no holding period. Operationally,
 * settlement accrues net funds to `pendingBalance`; this use-case clears exactly
 * the requested amount from `pending → available` so the later approval can
 * reserve it. The requestable ceiling is therefore `available + pending`, and a
 * request over that ceiling is rejected (never a partial or negative balance).
 */
/** Duplicate-key detection for the requestKey unique index. */
function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000
}

export class RequestPayoutUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly transferRecipientRepo: TransferRecipientRepositoryPort,
    private readonly payoutRepo: PayoutRepositoryPort,
    private readonly campaignBalanceRepo: CampaignBalanceRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly payoutsConfig: PayoutsConfig,
    // Split-proceeds (spec §17): when enabled and the campaign runs an active
    // split, campaign-level payouts are blocked in favour of per-beneficiary
    // payouts. Optional/flag-gated so the ordinary flow is unaffected.
    private readonly campaignSplitRepo?: CampaignSplitRepositoryPort,
    private readonly splitProceedsEnabled = false,
    // ADR-5 (G6): when wired, fee/reserve values resolve from the versioned
    // commercial-config store (overrides layered over the env defaults). Absent,
    // the static `payoutsConfig` is used unchanged.
    private readonly configService?: {
      resolvePayoutsConfig(): Promise<PayoutsConfig>
    },
    /**
     * Optional: lets a coupon discount the payout service fee. Absent, a
     * couponCode on the request is ignored entirely and the fee stands.
     */
    private readonly couponService?: CouponService,
    private readonly couponRedemptionRepo?: CouponRedemptionRepositoryPort,
    private readonly couponRepo?: CouponRepositoryPort,
  ) {}

  async execute(
    campaignId: string,
    input: RequestPayoutInput,
    requester: PayoutRequester,
  ): Promise<Payout> {
    const wallet = input.destination === 'ujimora_wallet'
    if (input.destination && !['paystack', 'ujimora_wallet'].includes(input.destination))
      throw new AppError('Unsupported payout destination', 422)
    if (wallet && !/^[0-9a-f-]{36}$/i.test(input.idempotencyKey ?? ''))
      throw new AppError('A transfer request key is required', 422)
    if (!wallet && !this.paymentGateway.isConfigured()) {
      throw new AppError('Payouts are not configured', 501)
    }

    const campaign = await this.campaignRepo.findById(campaignId)
    if (!campaign) {
      throw new AppError('Campaign not found', 404)
    }

    const isOwner = campaign.creatorId === requester.userId
    const isAdmin = requester.role === 'admin'
    if (!isOwner && !isAdmin) {
      throw new AppError('Only the campaign owner can request a payout', 403)
    }

    // A split campaign disburses per beneficiary; the campaign-level payout is
    // blocked so the two paths can never both move the same funds.
    if (this.splitProceedsEnabled && this.campaignSplitRepo) {
      const activeSplit = await this.campaignSplitRepo.findActive(campaignId)
      if (activeSplit) {
        throw new AppError(
          'This campaign shares proceeds; request per-beneficiary payouts instead',
          409,
        )
      }
    }

    const amount = round2(Number(input.amount))
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('Payout amount must be greater than zero', 422)
    }

    const requestKey = input.idempotencyKey
      ? `${requester.userId}:${input.idempotencyKey}`
      : undefined
    if (requestKey && this.payoutRepo.findByRequestKey) {
      const previous = await this.payoutRepo.findByRequestKey(requestKey)
      if (previous) {
        if (
          previous.campaignId !== campaignId ||
          previous.amount !== amount ||
          previous.type !== (input.type ?? 'standard') ||
          previous.provider !== (wallet ? 'ujimora_wallet' : 'paystack')
        )
          throw new AppError('Request key already used with different details', 409)
        return toPayoutDto(previous)
      }
    }
    const reference = wallet
      ? `wallet-request:${campaign.creatorId}:${input.idempotencyKey}`
      : undefined
    if (reference) {
      const previous = await this.payoutRepo.findByProviderRef(reference)
      if (previous) {
        if (
          previous.campaignId !== campaignId ||
          previous.amount !== amount ||
          previous.type !== (input.type ?? 'standard')
        )
          throw new AppError('Request key already used with different details', 409)
        return toPayoutDto(previous)
      }
    }
    const recipient = wallet
      ? { id: `wallet:${campaign.creatorId}`, currency: 'GHS' }
      : await this.transferRecipientRepo.findLatestByCampaignId(campaignId)
    if (!recipient) {
      throw new AppError('Add a payout recipient before requesting a payout', 400)
    }

    const balance = await this.campaignBalanceRepo.findByCampaignId(campaignId)
    const available = balance?.availableBalance ?? 0
    const pending = balance?.pendingBalance ?? 0
    const currency = balance?.currency ?? recipient.currency ?? CURRENCY
    const eligible = roundToCurrency(available + pending, currency)
    if (wallet && currency !== 'GHS')
      throw new AppError('Ujimora Wallet transfers require GHS', 422)

    if (amount > eligible) {
      throw new AppError(
        `Cannot request a payout of ${currency} ${amount.toLocaleString(
          'en-US',
        )}; only ${currency} ${eligible.toLocaleString('en-US')} is available for payout.`,
        422,
      )
    }

    // Payout service fee + net the beneficiary receives (spec §17). `standard`
    // is free; the chosen type sets the fee, deducted from the disbursed amount.
    // Fee/reserve values come from the versioned commercial-config store when
    // wired (ADR-5), else the static env config.
    const cfg = this.configService
      ? await this.configService.resolvePayoutsConfig()
      : this.payoutsConfig
    const type = input.type ?? 'standard'
    if (campaignNeedsEarlyCashout(campaign) && !isEarlyWithdrawal(type)) {
      throw new AppError(
        'This campaign is still active and below its goal. Select early or urgent cashout; the additional service fee applies on top of the plan fee already deducted at settlement.',
        422,
      )
    }
    let { fee, netAmount } = computePayoutFee(type, amount, cfg, currency)

    // A coupon here discounts the SERVICE FEE, never the amount withdrawn: the
    // recipient keeps more and the platform forgoes fee revenue, so the cost is
    // bounded by the fee itself. A `standard` payout is already free, so there
    // is nothing to discount and the code is refused rather than silently
    // consuming a redemption for no benefit.
    if (input.couponCode?.trim() && this.couponService) {
      if (fee <= 0) {
        throw new AppError('There is no fee on this payout to discount', 422)
      }
      const pricing = await this.couponService.validateAndPrice({
        code: input.couponCode,
        userId: requester.userId,
        baseAmount: fee,
        surface: CouponSurface.PAYOUT_FEE,
      })
      // Redeem here, not later. The discount takes effect on this request and
      // no money has moved yet, so unlike the subscription rail the caps can be
      // enforced strictly: if the coupon is exhausted the request is refused
      // outright rather than honoured at a price it no longer qualifies for.
      const now = new Date()
      const slot = await this.couponRedemptionRepo?.createWithSeat(
        {
          id: '',
          couponId: pricing.coupon.id,
          code: pricing.coupon.code,
          userId: requester.userId,
          surface: CouponSurface.PAYOUT_FEE,
          status: CouponRedemptionStatus.PENDING,
          baseAmount: pricing.baseAmount,
          discountAmount: pricing.discountAmount,
          finalAmount: pricing.finalAmount,
          currency,
          createdAt: now,
          updatedAt: now,
        },
        pricing.coupon.perUserLimit,
      )
      if (this.couponRedemptionRepo && !slot) {
        throw new AppError(
          'You have already used this coupon the maximum number of times',
          422,
        )
      }

      const bumped = await this.couponRepo?.incrementRedemptionIfUnderLimit(pricing.coupon.id)
      if (this.couponRepo && !bumped) {
        // Someone took the last redemption between the quote and here. Give the
        // seat back so this organizer is not charged for a coupon they never got.
        if (slot) await this.couponRedemptionRepo?.markReleased(slot.id)
        throw new AppError('This coupon has reached its redemption limit', 422)
      }
      if (slot) await this.couponRedemptionRepo?.markConsumed(slot.id)

      // The redemption row above carries couponId, userId and surface, which is
      // the audit trail; the payout itself only needs the discounted fee.
      fee = pricing.finalAmount
      netAmount = roundToCurrency(amount - fee, currency)
    }

    if (netAmount <= 0) {
      throw new AppError('The payout fee equals or exceeds the requested amount', 422)
    }

    // Early/urgent withdrawals may take only a capped share of the eligible
    // balance, leaving a reserve (spec §17).
    if (isEarlyWithdrawal(type)) {
      const earlyCeiling = roundToCurrency(
        (eligible * cfg.earlyMaxWithdrawalPercent) / 100,
        currency,
      )
      if (amount > earlyCeiling) {
        throw new AppError(
          `Early payouts are capped at ${cfg.earlyMaxWithdrawalPercent}% of the eligible balance (max ${currency} ${earlyCeiling.toLocaleString('en-US')}).`,
          422,
        )
      }
    }

    // Clear just enough pending → available so the approval step can reserve the
    // full requested amount out of `availableBalance`.
    const needed = roundToCurrency(amount - available, currency)
    if (needed > 0) {
      const cleared = await this.campaignBalanceRepo.clearPendingToAvailable(campaignId, needed)
      if (!cleared) {
        throw new AppError('Insufficient cleared funds for this payout; please try again.', 422)
      }
    }

    let saved: PayoutEntity
    try {
      saved = await this.payoutRepo.create(
        new PayoutEntity({
          id: '',
          requestKey,
          campaignId: campaign.id,
          recipientId: recipient.id,
          amount,
          type,
          fee,
          netAmount,
          currency,
          status: 'PENDING',
          provider: wallet ? 'ujimora_wallet' : 'paystack',
          providerRef: reference,
          requestedBy: requester.userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      )
    } catch (error) {
      // The findByRequestKey check above is a read, so two concurrent requests
      // with the same key both reach this create and the loser hits the unique
      // index. That E11000 is not mapped by the error handler, so it surfaced as
      // a 500 instead of the idempotent replay — and, worse, this request had
      // already run the non-idempotent clearPendingToAvailable, permanently
      // understating pendingBalance. Compensate, then replay the winner.
      if (isDuplicateKeyError(error) && requestKey && this.payoutRepo.findByRequestKey) {
        if (needed > 0) {
          await this.campaignBalanceRepo.returnAvailableToPending(campaignId, needed)
        }
        const winner = await this.payoutRepo.findByRequestKey(requestKey)
        if (winner) return toPayoutDto(winner)
      }
      throw error
    }

    return toPayoutDto(saved)
  }
}
