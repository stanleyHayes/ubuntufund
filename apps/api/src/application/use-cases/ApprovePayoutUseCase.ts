import type { WalletPayoutPort } from '../../domain/ports/outbound/WalletPayoutPort.js'
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js'
import { campaignNeedsEarlyCashout, isEarlyWithdrawal } from '../services/payoutFee.js'
import { TransferOutcomeUnknownError } from '../../domain/errors/TransferOutcomeUnknownError.js'
import { randomUUID } from 'node:crypto'
import type { Payout, PayoutLeg } from '@ubuntu-fund/types'
import type { PayoutRepositoryPort } from '../../domain/ports/outbound/PayoutRepositoryPort.js'
import type { TransferRecipientRepositoryPort } from '../../domain/ports/outbound/TransferRecipientRepositoryPort.js'
import type { CampaignBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBalanceRepositoryPort.js'
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js'
import type { TransferRecipientEntity } from '../../domain/entities/TransferRecipient.js'
import type { PayoutEntity } from '../../domain/entities/Payout.js'
import type { PayoutsConfig } from '../../infrastructure/config/index.js'
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js'
import { logger } from '../../infrastructure/logging/logger.js'
import { toPayoutDto } from './mappers/payoutDto.js'
import { splitIntoTransferLegs, requiresBatching } from '../services/payoutBatch.js'
import type { PayoutRequester } from './CreatePayoutRecipientUseCase.js'

/**
 * ADMIN approves a PENDING payout: verify platform balance, reserve the funds
 * out of the campaign's `availableBalance` (available → in-transit), initiate
 * the provider transfer with a unique reference, and move the payout to
 * PROCESSING. The authoritative outcome arrives later via the signed
 * `transfer.*` webhook.
 *
 * Two extensions guard large payouts (spec §16, §17 / ADR-4):
 *  - **Maker-checker:** a payout whose gross is ≥ `dualApprovalAmount` needs two
 *    distinct admin approvals. The first records the maker and leaves the payout
 *    PENDING; the second (a different admin) initiates the transfer.
 *  - **Batching:** a payout whose net exceeds the provider single-transfer
 *    ceiling is split into ≤-ceiling legs, each its own reconciled transfer.
 *    Batching today covers standard (fee-free) payouts only; expedited large
 *    payouts are rejected pending the higher-limit provider arrangement.
 *
 * On any failure to initiate, reservations are returned to `availableBalance`
 * and the payout is marked FAILED — money is never left stranded in transit.
 */
export class ApprovePayoutUseCase {
  constructor(
    private readonly payoutRepo: PayoutRepositoryPort,
    private readonly transferRecipientRepo: TransferRecipientRepositoryPort,
    private readonly campaignBalanceRepo: CampaignBalanceRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly payoutsConfig: PayoutsConfig,
    private readonly campaigns?: CampaignRepositoryPort,
    private readonly walletPayouts?: WalletPayoutPort,
  ) {}

  async recipientDetails(payoutId: string, requester: PayoutRequester) {
    if (requester.role !== 'admin') throw new AppError('Admin access required', 403)
    const payout = await this.payoutRepo.findById(payoutId)
    if (!payout) throw new AppError('Payout not found', 404)
    if (payout.provider === 'ujimora_wallet')
      return {
        accountName: 'Ujimora Wallet',
        accountNumber: payout.recipientId.slice(7),
        bankCode: 'Ujimora',
        type: 'ujimora_wallet',
        verificationStatus: 'internal_wallet',
      }
    const recipient = await this.transferRecipientRepo.findById(payout.recipientId)
    if (!recipient) throw new AppError('Payout recipient not found', 404)
    const p = recipient.toPlain()
    return {
      accountName: p.accountName,
      resolvedAccountName: p.resolvedAccountName,
      accountNumber: p.accountNumber,
      bankCode: p.bankCode,
      type: p.type,
      verificationStatus: p.verificationStatus ?? 'needs_review',
      reviewNote: p.reviewNote,
    }
  }

  async executeAutomatic(payoutId: string): Promise<Payout> {
    return this.execute(
      payoutId,
      { userId: 'system:auto-payout', role: 'admin' },
      'Automatic payout under recorded destination review and configured limits.',
      true,
    )
  }

  async execute(
    payoutId: string,
    requester: PayoutRequester,
    reviewNote?: string,
    automatic = false,
  ): Promise<Payout> {
    if (requester.role !== 'admin') {
      throw new AppError('Only an admin can approve a payout', 403)
    }

    const payout = await this.payoutRepo.findById(payoutId)
    if (!payout) {
      throw new AppError('Payout not found', 404)
    }
    if (payout.provider !== 'ujimora_wallet' && !this.paymentGateway.isConfigured())
      throw new AppError('Payouts are not configured', 501)
    if (payout.status !== 'PENDING') {
      throw new AppError(`Payout cannot be approved in state ${payout.status}`, 409)
    }

    if (this.campaigns) {
      const campaign = await this.campaigns.findById(payout.campaignId)
      if (!campaign) throw new AppError('Campaign not found', 404)
      if (
        payout.provider === 'ujimora_wallet' &&
        payout.recipientId !== `wallet:${campaign.creatorId}`
      )
        throw new AppError('Wallet destination must belong to the campaign owner', 409)
      if (campaignNeedsEarlyCashout(campaign) && !isEarlyWithdrawal(payout.type)) {
        throw new AppError(
          'Early cashout requires an early or urgent request with its additional fee. This request cannot bypass that fee.',
          422,
        )
      }
    }

    // Every approval attests to this payout's immutable destination, including legacy accounts.
    if (!reviewNote || reviewNote.trim().length < 20)
      throw new AppError(
        'Record beneficiary ownership and receiving-capacity review before approving (at least 20 characters).',
        422,
      )
    if (
      automatic &&
      (payout.provider !== 'paystack' ||
        (this.payoutsConfig.dualApprovalAmount > 0 &&
          payout.amount >= this.payoutsConfig.dualApprovalAmount))
    )
      throw new AppError('Manual approval required', 409)
    if (payout.provider !== 'ujimora_wallet' && !automatic) {
      if (!this.transferRecipientRepo.recordReview)
        throw new AppError('Recipient review storage is unavailable', 503)
      await this.transferRecipientRepo.recordReview(
        payout.recipientId,
        requester.userId,
        reviewNote.trim(),
        payoutId,
      )
    }

    if (payout.provider === 'ujimora_wallet') {
      if (!this.walletPayouts) throw new AppError('Wallet transfers unavailable', 503)
      await this.walletPayouts.recordCampaignReview(payout.id, requester.userId, reviewNote.trim())
    }
    // Maker-checker: a high-value payout needs two distinct admin approvals.
    const dualThreshold = this.payoutsConfig.dualApprovalAmount
    if (dualThreshold > 0 && payout.amount >= dualThreshold) {
      if (!payout.firstApprovedBy) {
        const recorded = await this.payoutRepo.recordFirstApproval(payout.id, requester.userId)
        if (!recorded) {
          throw new AppError('Payout is no longer pending approval', 409)
        }
        // Still PENDING — a second, different admin must approve to initiate.
        return toPayoutDto(recorded)
      }
      if (payout.firstApprovedBy === requester.userId) {
        throw new AppError('A second, different admin must approve this high-value payout', 409)
      }
      // A distinct second admin is approving — proceed to initiate the transfer.
    }

    if (payout.provider === 'ujimora_wallet') {
      if (!this.walletPayouts || !this.campaigns)
        throw new AppError('Wallet transfers unavailable', 503)
      await this.walletPayouts.settleCampaign(payout.id, requester.userId, reviewNote.trim())
      return toPayoutDto((await this.payoutRepo.findById(payout.id))!)
    }

    const recipient = await this.transferRecipientRepo.findById(payout.recipientId)
    if (!recipient) {
      throw new AppError('Payout recipient not found', 404)
    }

    const mustBatch = requiresBatching(payout.netAmount, this.payoutsConfig.maxTransferAmount)
    if (mustBatch && recipient.type === 'mobile_money')
      throw new AppError(
        'This payout exceeds the single-transfer ceiling. Use a verified bank account or arrange a reviewed payout amount; MoMo transfers are not automatically split to work around wallet limits.',
        422,
      )
    // Batching supports standard (fee-free) payouts only for now; expedited
    // large payouts await the reviewed higher-limit provider arrangement (§13).
    if (mustBatch && (payout.type !== 'standard' || payout.fee > 0)) {
      throw new AppError(
        `Expedited payouts above the GHS ${this.payoutsConfig.maxTransferAmount} single-transfer ceiling require the higher-limit arrangement — request a standard payout instead`,
        422,
      )
    }

    // Never initiate a transfer the platform balance cannot cover. Only the net
    // (amount − fee) is actually sent to the beneficiary; the fee is retained.
    const balances = await this.paymentGateway.getBalance()
    const gatewayBalance = balances.find((b) => b.currency === payout.currency)
    if (!gatewayBalance || gatewayBalance.balance < payout.netAmount) {
      throw new AppError('Insufficient platform balance to fund this payout', 422)
    }

    // Reserve the funds atomically (available → in-transit). A short balance
    // leaves the payout untouched (still PENDING) so it can be retried.
    const reserved = await this.campaignBalanceRepo.reserveForPayout(
      payout.campaignId,
      payout.amount,
    )
    if (!reserved) {
      throw new AppError('Insufficient available balance to fund this payout', 422)
    }

    const approvedBy = requester.userId
    if (mustBatch) {
      return this.initiateBatched(payout, recipient, approvedBy)
    }

    // Unique idempotency reference; the transfer webhook correlates on it.
    const reference = `pout-${payout.id}-${randomUUID().slice(0, 8)}`

    const processing = await this.payoutRepo.transitionToProcessing(payout.id, {
      approvedBy,
      providerRef: reference,
    })
    if (!processing) {
      // Another approval won the race; return our reservation.
      await this.campaignBalanceRepo.returnToAvailable(payout.campaignId, payout.amount)
      throw new AppError('Payout is no longer pending approval', 409)
    }

    let transfer
    try {
      transfer = await this.paymentGateway.initiateTransfer({
        currency: payout.currency,
        // Send the net (amount − fee); the fee stays on-platform.
        amount: payout.netAmount,
        recipientCode: recipient.recipientCode,
        reference,
        reason: `Payout for campaign ${payout.campaignId}`,
      })
    } catch (error) {
      if (error instanceof TransferOutcomeUnknownError) {
        throw new AppError(error.message, 502)
      }
      await this.rollback(processing.id, payout.campaignId, payout.amount)
      logger.error({ err: error, payoutId: payout.id }, 'payout transfer initiation failed')
      if (error instanceof AppError) throw error
      throw new AppError('Failed to initiate payout transfer', 502)
    }

    if (['failed', 'abandoned', 'blocked', 'rejected'].includes(transfer.status)) {
      await this.rollback(processing.id, payout.campaignId, payout.amount)
      throw new AppError('Payout transfer was rejected by the provider', 502)
    }

    await this.payoutRepo.setProviderStatus?.(payout.id, transfer.status)
    const updated = await this.payoutRepo.attachTransferCode(payout.id, transfer.transferCode)
    return toPayoutDto(updated ?? processing)
  }

  /**
   * Split a large standard payout into ≤-ceiling legs and submit each as its own
   * transfer. The full gross reservation is already held. Each leg carries a
   * unique reference the webhook reconciles on; the payout settles PAID only
   * when every leg succeeds, and lands in NEEDS_REVIEW if any leg fails after
   * another already sent (real money that cannot be un-sent).
   */
  private async initiateBatched(
    payout: PayoutEntity,
    recipient: TransferRecipientEntity,
    approvedBy: string,
  ): Promise<Payout> {
    const amounts = splitIntoTransferLegs(payout.netAmount, this.payoutsConfig.maxTransferAmount)
    const legs: PayoutLeg[] = amounts.map((amount, index) => ({
      index,
      amount,
      reference: `pout-${payout.id}-L${index}-${randomUUID().slice(0, 8)}`,
      status: 'queued',
    }))
    const batchRef = `pout-${payout.id}-batch-${randomUUID().slice(0, 8)}`

    const processing = await this.payoutRepo.transitionToProcessingBatched(payout.id, {
      approvedBy,
      providerRef: batchRef,
      legs,
    })
    if (!processing) {
      await this.campaignBalanceRepo.returnToAvailable(payout.campaignId, payout.amount)
      throw new AppError('Payout is no longer pending approval', 409)
    }

    let submitted = 0
    const failed: PayoutLeg[] = []
    for (const leg of legs) {
      try {
        const transfer = await this.paymentGateway.initiateTransfer({
          amount: leg.amount,
          currency: payout.currency,
          recipientCode: recipient.recipientCode,
          reference: leg.reference,
          reason: `Payout for campaign ${payout.campaignId} (leg ${leg.index + 1}/${legs.length})`,
        })
        if (['failed', 'abandoned', 'blocked', 'rejected'].includes(transfer.status)) {
          failed.push(leg)
          continue
        }
        await this.payoutRepo.setLegStatus(payout.id, leg.reference, ['queued'], 'submitted', {
          transferCode: transfer.transferCode,
        })
        submitted += 1
      } catch (error) {
        logger.error(
          { err: error, payoutId: payout.id, leg: leg.reference },
          'payout leg initiation failed',
        )
        if (error instanceof TransferOutcomeUnknownError) {
          // Keep this queued leg reserved; verify its existing reference later.
          submitted += 1
        } else {
          failed.push(leg)
        }
      }
    }

    if (submitted === 0) {
      // Nothing left the platform — clean rollback: return the whole reservation
      // once and mark FAILED (symmetric with a single-transfer initiation failure).
      //
      // Both halves of that have to be idempotent. A `transfer.failed` webhook
      // for a leg whose transfer existed at the provider can land while a later
      // leg is still in flight, and it returns that leg keyed
      // `leg:<ref>:returned`. So: claim each leg first and only count the ones
      // we win, then gate the gross return on winning the terminal transition
      // and key it — exactly as the single-transfer rollback() below does.
      let returnedByWebhook = 0
      for (const leg of legs) {
        const won = await this.payoutRepo.setLegStatus(
          payout.id,
          leg.reference,
          ['queued'],
          'failed',
        )
        if (!won) returnedByWebhook += leg.amount
      }
      const failedNow = await this.payoutRepo.transitionToFailed(payout.id)
      if (failedNow) {
        await this.campaignBalanceRepo.returnToAvailable(
          payout.campaignId,
          payout.amount - returnedByWebhook,
          `pout:${payout.id}:returned`,
        )
        await this.payoutRepo.markSettlementApplied(payout.id, 'FAILED')
      }
      throw new AppError('Payout transfer was rejected by the provider', 502)
    }

    // Some legs submitted, others failed to initiate: return only the failed
    // legs' reservations. The batch can no longer all-succeed, so it will settle
    // NEEDS_REVIEW once the submitted legs' webhooks arrive.
    for (const leg of failed) {
      const won = await this.payoutRepo.setLegStatus(payout.id, leg.reference, ['queued'], 'failed')
      if (won) {
        // Key it: the reconciler's repairBatched credits every `failed` leg as
        // `leg:<ref>:returned`, so an unkeyed credit here is handed out twice.
        await this.campaignBalanceRepo.returnToAvailable(
          payout.campaignId,
          leg.amount,
          `leg:${leg.reference}:returned`,
        )
      }
    }

    const updated = await this.payoutRepo.findById(payout.id)
    return toPayoutDto(updated ?? processing)
  }

  /**
   * Undo a reservation + PROCESSING transition when initiation fails. Gate the
   * money return on WINNING the terminal transition: if a transfer.failed webhook
   * already settled this payout (returning the reservation) while we were
   * suspended in initiateTransfer, we must not return it again — exactly one of
   * {this rollback, the webhook} restores the reservation.
   */
  private async rollback(payoutId: string, campaignId: string, amount: number): Promise<void> {
    const failed = await this.payoutRepo.transitionToFailed(payoutId)
    if (!failed) return
    // Return with the same settleRef the webhook/reconciler use AND flag
    // settlement-applied, so this rollback-produced FAILED payout is never
    // re-detected as unsettled and double-returned by the reconciliation repair.
    await this.campaignBalanceRepo.returnToAvailable(
      campaignId,
      amount,
      `pout:${payoutId}:returned`,
    )
    await this.payoutRepo.markSettlementApplied(payoutId, 'FAILED')
  }
}
