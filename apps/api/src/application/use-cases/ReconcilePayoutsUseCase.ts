import type { PayoutRepositoryPort } from '../../domain/ports/outbound/PayoutRepositoryPort.js'
import type { BeneficiaryPayoutRepositoryPort } from '../../domain/ports/outbound/BeneficiaryPayoutRepositoryPort.js'
import type { AffiliatePayoutRepositoryPort } from '../../domain/ports/outbound/AffiliatePayoutRepositoryPort.js'
import type { CreatorPayoutRepositoryPort } from '../../domain/ports/outbound/CreatorPayoutRepositoryPort.js'
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js'
import { logger } from '../../infrastructure/logging/logger.js'

/**
 * A settlement handler exposing the three terminal transitions the reconciler
 * drives. Both {@link HandlePayoutWebhookUseCase} and
 * {@link HandleBeneficiaryPayoutWebhookUseCase} satisfy it.
 */
export interface PayoutWebhookHandler {
  handleSuccess(reference: string): Promise<void>
  handleFailed(reference: string): Promise<void>
  handleReversed(reference: string): Promise<void>
  /** Re-apply the (idempotent) settlement effect for a terminal-but-unsettled payout. */
  repairSettlement?(payoutId: string): Promise<void>
  /**
   * Re-apply every terminal leg's (idempotent) effect for a batched payout stuck
   * in PROCESSING and re-run its finalization. Only the campaign handler batches.
   */
  repairBatched?(payoutId: string): Promise<void>
}

export interface ReconcilePayoutSummary {
  scanned: number
  settled: number
  failed: number
  reversed: number
  pending: number
  /** PAID-but-unsettled payouts whose idempotent settlement effect was re-applied. */
  repaired: number
  /** Batched payouts stuck past the dwell window and handed to a human. */
  escalated: number
  errored: number
}

/**
 * How long a batched payout may sit in PROCESSING with in-flight legs before it
 * is escalated to NEEDS_REVIEW. Long enough that a merely slow provider webhook
 * is never escalated; short enough that reserved funds are not stranded for
 * days without anyone noticing.
 */
const STUCK_BATCH_ESCALATION_MS = 24 * 60 * 60 * 1000

/**
 * Reconciles payouts stuck in PROCESSING (a provider `transfer.*` webhook was
 * missed or delayed, leaving funds reserved out of `availableBalance` but never
 * disbursed nor returned). For each stale single-transfer payout it re-verifies
 * the transfer against the provider and drives the SAME settlement handler the
 * webhook would — which is idempotent (gated by the atomic state transition), so
 * a payout already settled by a late webhook is a harmless no-op. Covers the
 * campaign, per-beneficiary and affiliate single-transfer rails, and batched
 * campaign payouts (each still-in-flight leg reconciled by its own reference).
 * Pending/OTP transfers are left untouched.
 */
export class ReconcilePayoutsUseCase {
  constructor(
    private readonly payoutRepo: PayoutRepositoryPort,
    private readonly beneficiaryPayoutRepo: BeneficiaryPayoutRepositoryPort,
    private readonly affiliatePayoutRepo: AffiliatePayoutRepositoryPort,
    private readonly handlePayoutWebhookUseCase: PayoutWebhookHandler,
    private readonly handleBeneficiaryPayoutWebhookUseCase: PayoutWebhookHandler,
    private readonly handleAffiliatePayoutWebhookUseCase: PayoutWebhookHandler,
    private readonly paymentGateway: PaymentGatewayPort,
    // Optional creator-withdrawal rail (`cpay-`): reconciled the same way when wired.
    private readonly handleCreatorPayoutWebhookUseCase?: PayoutWebhookHandler,
    private readonly creatorPayoutRepo?: CreatorPayoutRepositoryPort,
  ) {}

  async reconcileStale(opts: { olderThanMinutes: number }): Promise<ReconcilePayoutSummary> {
    const summary: ReconcilePayoutSummary = {
      scanned: 0,
      settled: 0,
      failed: 0,
      reversed: 0,
      pending: 0,
      repaired: 0,
      escalated: 0,
      errored: 0,
    }
    if (!this.paymentGateway.isConfigured()) return summary

    const cutoff = new Date(Date.now() - opts.olderThanMinutes * 60_000)

    const campaign = await this.payoutRepo.findStuckProcessing(cutoff)
    for (const payout of campaign) {
      if (payout.providerRef) {
        await this.reconcileOne(payout.providerRef, this.handlePayoutWebhookUseCase, summary)
      }
    }

    const beneficiary = await this.beneficiaryPayoutRepo.findStuckProcessing(cutoff)
    for (const payout of beneficiary) {
      if (payout.providerRef) {
        await this.reconcileOne(
          payout.providerRef,
          this.handleBeneficiaryPayoutWebhookUseCase,
          summary,
        )
      }
    }

    const affiliate = await this.affiliatePayoutRepo.findStuckProcessing(cutoff)
    for (const payout of affiliate) {
      if (payout.providerRef) {
        await this.reconcileOne(
          payout.providerRef,
          this.handleAffiliatePayoutWebhookUseCase,
          summary,
        )
      }
    }

    if (this.creatorPayoutRepo && this.handleCreatorPayoutWebhookUseCase) {
      const creator = await this.creatorPayoutRepo.findStuckProcessing(cutoff)
      for (const payout of creator) {
        if (payout.providerRef) {
          await this.reconcileOne(
            payout.providerRef,
            this.handleCreatorPayoutWebhookUseCase,
            summary,
          )
        }
      }
    }

    // Batched campaign payouts: reconcile each still-in-flight leg by its own
    // reference; the leg-aware webhook handler settles the leg and reconciles
    // the batch to PAID/NEEDS_REVIEW once every leg is terminal.
    const batched = await this.payoutRepo.findStuckBatchedProcessing(cutoff)
    for (const payout of batched) {
      // Re-apply any terminal leg whose effect a crash left unapplied FIRST —
      // before reconciling in-flight legs. Batch finalization (transitionBatchedToPaid)
      // checks leg STATUS, not whether each leg's effect landed, so a sibling leg
      // completing in this same sweep could otherwise flip the batch to PAID and
      // strand the crashed leg's effect (repairBatched only runs while PROCESSING).
      // Idempotent per leg settleRef, so re-applying an already-applied leg is a no-op.
      try {
        await this.handlePayoutWebhookUseCase.repairBatched?.(payout.id)
      } catch (error) {
        logger.error({ error, payoutId: payout.id }, 'payout reconciliation: batch repair failed')
        summary.errored += 1
      }
      const inFlight = (payout.legs ?? []).filter(
        (leg) => leg.status === 'queued' || leg.status === 'submitted',
      )
      for (const leg of inFlight) {
        await this.reconcileOne(leg.reference, this.handlePayoutWebhookUseCase, summary)
      }

      // Escalate a batch that has sat in PROCESSING past the dwell window.
      //
      // A leg whose POST /transfer aborted before reaching Paystack is counted
      // as submitted but never gets a transfer code, so no webhook arrives and
      // verifyTransfer throws on the unknown reference every sweep — the batch
      // was pinned in PROCESSING forever with the campaign's gross reserved out
      // of availableBalance and no admin path to recover it (approve needs
      // PENDING; transfer-control and the reconcile script both reject batched
      // payouts). We deliberately do NOT auto-fail the leg: the transfer may
      // genuinely exist at the provider, and returning the reservation on a
      // transfer that later succeeds would double-spend. Escalating instead puts
      // it in front of a human with the money still reserved — safe either way.
      const stuckSince = Date.now() - new Date(payout.updatedAt).getTime()
      if (inFlight.length > 0 && stuckSince >= STUCK_BATCH_ESCALATION_MS) {
        const flagged = await this.payoutRepo.flagNeedsReview(payout.id)
        if (flagged) {
          summary.escalated += 1
          logger.warn(
            {
              payoutId: payout.id,
              hoursStuck: Math.round(stuckSince / 3_600_000),
              legs: inFlight.map((leg) => ({ reference: leg.reference, status: leg.status })),
            },
            'payout reconciliation: batched payout stuck past dwell window; escalated for review',
          )
        }
      }
    }

    // Repair terminal-but-unsettled payouts (a crash between the state transition
    // and the balance/ledger write). The repair re-applies the SAME idempotent
    // effect, so a payout that actually settled is a harmless no-op.
    const paidUnsettled = await this.payoutRepo.findTerminalUnsettled(cutoff)
    for (const payout of paidUnsettled) {
      await this.handlePayoutWebhookUseCase.repairSettlement?.(payout.id)
      summary.repaired += 1
    }
    const beneUnsettled = await this.beneficiaryPayoutRepo.findTerminalUnsettled(cutoff)
    for (const payout of beneUnsettled) {
      await this.handleBeneficiaryPayoutWebhookUseCase.repairSettlement?.(payout.id)
      summary.repaired += 1
    }
    const affUnsettled = await this.affiliatePayoutRepo.findTerminalUnsettled(cutoff)
    for (const payout of affUnsettled) {
      await this.handleAffiliatePayoutWebhookUseCase.repairSettlement?.(payout.id)
      summary.repaired += 1
    }
    if (this.creatorPayoutRepo && this.handleCreatorPayoutWebhookUseCase) {
      const creatorUnsettled = await this.creatorPayoutRepo.findTerminalUnsettled(cutoff)
      for (const payout of creatorUnsettled) {
        await this.handleCreatorPayoutWebhookUseCase.repairSettlement?.(payout.id)
        summary.repaired += 1
      }
    }

    return summary
  }

  private async reconcileOne(
    reference: string,
    handler: PayoutWebhookHandler,
    summary: ReconcilePayoutSummary,
  ): Promise<void> {
    summary.scanned += 1
    let status: string
    try {
      const result = await this.paymentGateway.verifyTransfer(reference)
      status = result.status
      const payout = await this.payoutRepo.findByProviderRef?.(reference)
      if (payout) await this.payoutRepo.setProviderStatus?.(payout.id, status)
    } catch (error) {
      logger.error({ error, reference }, 'payout reconciliation: verify failed')
      summary.errored += 1
      return
    }

    // Drive the same idempotent settlement the webhook would.
    //
    // This has to be caught too, not just the verify above. The sweep walks every
    // rail in one pass, so an exception escaping here (a Mongo WriteConflict, a
    // throwing flagNeedsReview) aborted the whole run — and because the poison
    // payout sorts first on every tick, reconciliation stayed blocked and every
    // other payout kept its funds reserved indefinitely.
    try {
      if (status === 'success') {
        await handler.handleSuccess(reference)
        summary.settled += 1
      } else if (['failed', 'abandoned', 'blocked', 'rejected'].includes(status)) {
        await handler.handleFailed(reference)
        summary.failed += 1
      } else if (status === 'reversed') {
        await handler.handleReversed(reference)
        summary.reversed += 1
      } else {
        // pending / otp / receipt / unknown — the provider hasn't decided; leave it.
        summary.pending += 1
      }
    } catch (error) {
      logger.error({ error, reference, status }, 'payout reconciliation: settlement failed')
      summary.errored += 1
    }
  }
}
