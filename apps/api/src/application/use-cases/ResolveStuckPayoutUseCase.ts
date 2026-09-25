import type { PayoutStatus } from '@ubuntu-fund/types'
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js'
import type { AuditLogRepositoryPort } from '../../domain/ports/outbound/AuditLogRepositoryPort.js'
import { TransferNotFoundError } from '../../domain/errors/TransferNotFoundError.js'
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js'
import { logger } from '../../infrastructure/logging/logger.js'
import type { PayoutWebhookHandler } from './ReconcilePayoutsUseCase.js'
import type { PayoutRequester } from './CreatePayoutRecipientUseCase.js'

export type StuckPayoutRail = 'campaign' | 'beneficiary' | 'affiliate' | 'creator'
export const STUCK_PAYOUT_RAILS: readonly StuckPayoutRail[] = ['campaign', 'beneficiary', 'affiliate', 'creator']

/** What the resolver needs from one payout rail. */
export interface StuckPayoutRailAccess {
  findById(id: string): Promise<{ id: string; status: PayoutStatus; providerRef?: string; legs?: unknown[] } | null>
  reopenForSettlement?(id: string): Promise<boolean>
  handler: PayoutWebhookHandler
}

export type StuckPayoutOutcome = 'success' | 'failed' | 'reversed'

/**
 * Admin resolution of a single-transfer payout escalated to NEEDS_REVIEW
 * because the provider could not confirm it for a full dwell window.
 *
 * The admin never chooses the outcome. The provider does: the transfer is
 * verified again and its authoritative state — success, a terminal failure, a
 * reversal, or "no such transfer" (the POST never reached Paystack) — is driven
 * through the rail's own idempotent settlement handler, exactly as a webhook
 * would. That handler settles once per settleRef, so the reservation is
 * returned (or paid out) exactly once even if this is replayed or races a late
 * webhook. A transfer still pending at the provider is left alone.
 */
export class ResolveStuckPayoutUseCase {
  constructor(
    private readonly gateway: PaymentGatewayPort,
    private readonly rails: Partial<Record<StuckPayoutRail, StuckPayoutRailAccess>>,
    private readonly audit?: AuditLogRepositoryPort,
  ) {}

  async execute(
    rail: StuckPayoutRail,
    payoutId: string,
    requester: PayoutRequester,
    note: string,
  ): Promise<{ rail: StuckPayoutRail; payoutId: string; providerOutcome: StuckPayoutOutcome; status: PayoutStatus }> {
    if (requester.role !== 'admin') throw new AppError('Only an admin can resolve a payout', 403)
    if (!note || note.trim().length < 20)
      throw new AppError('Record what you checked before resolving (at least 20 characters).', 422)
    const access = this.rails[rail]
    if (!access?.reopenForSettlement) throw new AppError('Unknown payout rail', 404)
    const payout = await access.findById(payoutId)
    if (!payout) throw new AppError('Payout not found', 404)
    if (payout.status !== 'NEEDS_REVIEW')
      throw new AppError(`Only a payout awaiting review can be resolved (this one is ${payout.status}).`, 409)
    if (payout.legs?.length)
      throw new AppError('Batched payouts are reconciled leg by leg; use the reconciliation runbook.', 409)
    if (!payout.providerRef) throw new AppError('This payout has no transfer reference to verify.', 409)
    if (!this.gateway.isConfigured()) throw new AppError('Payouts are not configured', 501)

    const outcome = await this.providerOutcome(payout.providerRef)
    if (!(await access.reopenForSettlement(payout.id)))
      throw new AppError('Payout changed while it was being resolved; refresh and try again.', 409)
    if (outcome === 'success') await access.handler.handleSuccess(payout.providerRef)
    else if (outcome === 'reversed') await access.handler.handleReversed(payout.providerRef)
    else await access.handler.handleFailed(payout.providerRef)

    const settled = await access.findById(payout.id)
    await this.audit?.record({
      actorId: requester.userId,
      actorRole: 'admin',
      action: 'payout.stuck_resolved',
      resource: `${rail}:${payout.id}`,
      details: `Provider outcome ${outcome}; payout now ${settled?.status ?? 'unknown'}`,
      reason: note.trim(),
      severity: 'warning',
    })
    logger.warn({ rail, payoutId: payout.id, outcome, status: settled?.status }, 'stuck payout resolved by admin')
    return { rail, payoutId: payout.id, providerOutcome: outcome, status: settled?.status ?? 'PROCESSING' }
  }

  private async providerOutcome(reference: string): Promise<StuckPayoutOutcome> {
    let status: string
    try {
      status = (await this.gateway.verifyTransfer(reference)).status
    } catch (error) {
      // Paystack never received this reference: nothing left the platform.
      if (error instanceof TransferNotFoundError) return 'failed'
      logger.error({ error, reference }, 'stuck payout resolution: verify failed')
      throw new AppError('Paystack could not be reached to confirm this transfer. Try again shortly.', 502)
    }
    if (status === 'success') return 'success'
    if (status === 'reversed') return 'reversed'
    if (['failed', 'abandoned', 'blocked', 'rejected'].includes(status)) return 'failed'
    throw new AppError(
      `Paystack still reports this transfer as "${status}". Resolve it once Paystack reaches a final state.`,
      409,
    )
  }
}
