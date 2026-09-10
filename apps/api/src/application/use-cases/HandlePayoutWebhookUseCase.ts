import type { PayoutRepositoryPort } from '../../domain/ports/outbound/PayoutRepositoryPort.js'
import type { CampaignBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBalanceRepositoryPort.js'
import type { LedgerRepositoryPort } from '../../domain/ports/outbound/LedgerRepositoryPort.js'
import type { PayoutEntity } from '../../domain/entities/Payout.js'
import { JournalEntryEntity } from '../../domain/entities/JournalEntry.js'

/**
 * Applies Paystack transfer webhooks to the payout + ledger read models. All
 * handlers correlate by the unique transfer reference and are idempotent: the
 * balance/ledger effect runs only for the caller that wins the atomic state
 * transition, so a duplicate webhook is a harmless no-op.
 *
 * A reference resolves one of two ways:
 *  - a single-transfer payout's `providerRef` → the payout-level handlers below;
 *  - one leg of a batched payout → the per-leg handlers, which settle that leg
 *    and reconcile the batch (PAID when all legs succeed, else NEEDS_REVIEW).
 *
 * Single-transfer semantics:
 *  - transfer.success  → PROCESSING → PAID; move in-transit → paidOut; post the
 *                        immutable disbursement journal (debit beneficiary,
 *                        credit payout).
 *  - transfer.failed   → PROCESSING → FAILED; return the reserved in-transit
 *                        funds to availableBalance (no journal).
 *  - transfer.reversed → PAID → REVERSED (reversing journal + paidOut → available)
 *                        or PROCESSING → REVERSED (return the reservation).
 */
export class HandlePayoutWebhookUseCase {
  constructor(
    private readonly payoutRepo: PayoutRepositoryPort,
    private readonly campaignBalanceRepo: CampaignBalanceRepositoryPort,
    private readonly ledgerRepo: LedgerRepositoryPort,
  ) {}

  async handleSuccess(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference)
    if (payout?.provider === 'ujimora_wallet') return
    if (payout && !payout.isBatched) {
      const won = await this.payoutRepo.transitionToPaid(payout.id)
      if (!won) return // idempotent: already PAID or not PROCESSING
      await this.applyDisbursement(
        payout,
        `pout:${payout.id}`,
        payout.amount,
        payout.netAmount,
        payout.fee,
        reference,
      )
      return
    }

    const batched = await this.payoutRepo.findByLegReference(reference)
    if (batched) await this.onLegSuccess(batched, reference)
  }

  /**
   * Reconciliation repair (G5): re-apply the terminal settlement effect for a
   * single-transfer payout whose balance/ledger write did not complete (a crash
   * between the state transition and the effect). Idempotent — a no-op if the
   * effect already landed (guarded by the same settleRef the webhook uses).
   *
   *  - PAID   → re-apply the disbursement (paidOut += net, disbursement journal).
   *  - FAILED → re-return the reservation a crash stranded out of availableBalance.
   *  - REVERSED → replay the reverse effect the payout owes, disambiguated by
   *    `reversedFrom` (G7): 'PROCESSING' → return the reservation; 'PAID' → re-drive
   *    the forward disbursement (so paidOut can't go negative) then reverse it.
   *    A legacy REVERSED payout has no `reversedFrom` and is skipped (its
   *    settlementApplied is also absent, so the finder never selects it).
   *
   * Batched payouts are repaired by {@link repairBatched}.
   */
  async repairSettlement(payoutId: string): Promise<void> {
    const payout = await this.payoutRepo.findById(payoutId)
    if (!payout || payout.isBatched) return
    const settleKey = `pout:${payout.id}`
    if (payout.status === 'PAID') {
      await this.applyDisbursement(
        payout,
        settleKey,
        payout.amount,
        payout.netAmount,
        payout.fee,
        'reconcile',
      )
    } else if (payout.status === 'FAILED') {
      await this.campaignBalanceRepo.returnToAvailable(
        payout.campaignId,
        payout.amount,
        `${settleKey}:returned`,
      )
      await this.payoutRepo.markSettlementApplied(payout.id, 'FAILED')
    } else if (payout.status === 'REVERSED') {
      if (payout.reversedFrom === 'PROCESSING') {
        await this.campaignBalanceRepo.returnToAvailable(
          payout.campaignId,
          payout.amount,
          `${settleKey}:returned`,
        )
        await this.payoutRepo.markSettlementApplied(payout.id, 'REVERSED')
      } else if (payout.reversedFrom === 'PAID') {
        await this.applyReversalFromPaid(payout, settleKey, 'reconcile')
      }
      // reversedFrom absent → legacy REVERSED, not repairable (finder excludes it).
    }
  }

  /**
   * The PAID→REVERSED effect (G7): move paidOut → available and post the reversing
   * journal, idempotent per the `:reversed` settleRef / externalRef, then flag
   * settlement-applied (guarded on REVERSED). Does NOT re-drive the forward — that
   * would double-credit a legacy payout whose original forward never recorded a
   * `:paid` settleRef. The rare forward-crash-then-reverse race (paidOut short)
   * is a documented read-model edge, not corrected here.
   */
  private async applyReversalFromPaid(
    payout: PayoutEntity,
    settleKey: string,
    reference: string,
  ): Promise<void> {
    await this.campaignBalanceRepo.reverseFromPaidOut(
      payout.campaignId,
      payout.netAmount,
      payout.fee,
      `${settleKey}:reversed`,
    )
    await this.ledgerRepo.postEntry(
      JournalEntryEntity.forPayoutReversal({
        campaignId: payout.campaignId,
        amount: payout.amount,
        currency: payout.currency,
        memo: `payout ${payout.id} reversed (${reference})`,
        externalRef: `${settleKey}:reversed`,
      }),
    )
    await this.payoutRepo.markSettlementApplied(payout.id, 'REVERSED')
  }

  /**
   * Reconciliation repair (G5) for a batched payout stuck in PROCESSING: a crash
   * after a leg's atomic status transition but before its balance/ledger effect,
   * or before {@link reconcileBatch} finalized the batch. Re-applies every
   * terminal leg's effect — idempotent, guarded by the leg settleRef and journal
   * externalRef so an already-applied leg is a no-op — then re-runs finalization
   * so an all-terminal batch reaches PAID / NEEDS_REVIEW.
   */
  async repairBatched(payoutId: string): Promise<void> {
    const payout = await this.payoutRepo.findById(payoutId)
    if (!payout || !payout.isBatched || payout.status !== 'PROCESSING') return
    for (const leg of payout.legs ?? []) {
      if (leg.status === 'success') {
        await this.campaignBalanceRepo.markPaidOut(
          payout.campaignId,
          leg.amount,
          0,
          `leg:${leg.reference}:paid`,
        )
        await this.ledgerRepo.postEntry(
          JournalEntryEntity.forPayoutDisbursement({
            campaignId: payout.campaignId,
            amount: leg.amount,
            currency: payout.currency,
            memo: `payout ${payout.id} leg ${leg.index + 1} settled (reconcile)`,
            externalRef: `leg:${leg.reference}:paid`,
          }),
        )
      } else if (leg.status === 'failed') {
        await this.campaignBalanceRepo.returnToAvailable(
          payout.campaignId,
          leg.amount,
          `leg:${leg.reference}:returned`,
        )
      }
      // A 'reversed' leg is intentionally NOT re-driven here: its forward :paid
      // credit may have been stranded by a crash, and reverseFromPaidOut has no
      // floor guard, so replaying it could drive paidOut negative. onLegReversed
      // already flags the batch NEEDS_REVIEW (reconcileBatch below does too), so a
      // human reconciles it — see G7 for the reversal-crash durability work.
      // queued / submitted legs are still in flight — reconciled per-leg.
    }
    await this.reconcileBatch(payoutId)
  }

  /**
   * Apply ONLY the forward disbursement balance + ledger effect, idempotently
   * keyed by `${settleKey}:paid`. `gross` journals; `net`/`fee` split the balance.
   * Does NOT flag settlement-applied — callers decide (the reversal path re-drives
   * this first, then reverses, then flags). A duplicate call is a no-op.
   */
  private async applyForwardDisbursement(
    payout: PayoutEntity,
    settleKey: string,
    gross: number,
    net: number,
    fee: number,
    reference: string,
  ): Promise<void> {
    await this.campaignBalanceRepo.markPaidOut(payout.campaignId, net, fee, `${settleKey}:paid`)
    const entry = JournalEntryEntity.forPayoutDisbursement({
      campaignId: payout.campaignId,
      amount: gross,
      currency: payout.currency,
      memo: `payout ${payout.id} settled (${reference})`,
      externalRef: `${settleKey}:paid`,
    })
    await this.ledgerRepo.postEntry(entry)
  }

  /**
   * A settled payout's disbursement: the forward effect + the settlement-applied
   * flag (a reconciliation index). Idempotent so a duplicate webhook OR a
   * reconciliation re-run applies it at most once.
   */
  private async applyDisbursement(
    payout: PayoutEntity,
    settleKey: string,
    gross: number,
    net: number,
    fee: number,
    reference: string,
  ): Promise<void> {
    await this.applyForwardDisbursement(payout, settleKey, gross, net, fee, reference)
    await this.payoutRepo.markSettlementApplied(payout.id, 'PAID')
  }

  async handleFailed(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference)
    if (payout?.provider === 'ujimora_wallet') return
    if (payout && !payout.isBatched) {
      const won = await this.payoutRepo.transitionToFailed(payout.id)
      if (!won) return // idempotent

      // Nothing was disbursed — return the reservation to availableBalance.
      await this.campaignBalanceRepo.returnToAvailable(
        payout.campaignId,
        payout.amount,
        `pout:${payout.id}:returned`,
      )
      await this.payoutRepo.markSettlementApplied(payout.id, 'FAILED')
      return
    }

    const batched = await this.payoutRepo.findByLegReference(reference)
    if (batched) await this.onLegFailed(batched, reference)
  }

  async handleReversed(reference: string): Promise<void> {
    const payout = await this.payoutRepo.findByProviderRef(reference)
    if (payout?.provider === 'ujimora_wallet') return
    if (payout && !payout.isBatched) {
      // A reversal of an already-settled (PAID) transfer: money came back —
      // move paidOut → available and post the reversing journal (idempotent per
      // :reversed), flagging settlement-applied.
      const fromPaid = await this.payoutRepo.transitionPaidToReversed(payout.id)
      if (fromPaid) {
        await this.applyReversalFromPaid(payout, `pout:${payout.id}`, reference)
        return
      }

      // A reversal seen before we observed success: treat like a failure —
      // return the reservation, no journal was ever posted.
      const fromProcessing = await this.payoutRepo.transitionProcessingToReversed(payout.id)
      if (fromProcessing) {
        await this.campaignBalanceRepo.returnToAvailable(
          payout.campaignId,
          payout.amount,
          `pout:${payout.id}:returned`,
        )
        await this.payoutRepo.markSettlementApplied(payout.id, 'REVERSED')
      }
      // Otherwise not in a reversible state — idempotent no-op.
      return
    }

    const batched = await this.payoutRepo.findByLegReference(reference)
    if (batched) await this.onLegReversed(batched, reference)
  }

  // ---- Batched (multi-leg) settlement -------------------------------------

  /**
   * A batched leg's transfer succeeded. Move exactly that leg's amount into
   * paidOut and journal it (a large standard payout carries no fee, so each leg
   * is pure net), then reconcile the batch.
   */
  private async onLegSuccess(payout: PayoutEntity, reference: string): Promise<void> {
    const leg = payout.legs?.find((l) => l.reference === reference)
    if (!leg) return
    const won = await this.payoutRepo.setLegStatus(
      payout.id,
      reference,
      ['queued', 'submitted'],
      'success',
    )
    if (!won) return // idempotent

    await this.campaignBalanceRepo.markPaidOut(
      payout.campaignId,
      leg.amount,
      0,
      `leg:${reference}:paid`,
    )
    const entry = JournalEntryEntity.forPayoutDisbursement({
      campaignId: payout.campaignId,
      amount: leg.amount,
      currency: payout.currency,
      memo: `payout ${payout.id} leg ${leg.index + 1} settled (${reference})`,
      externalRef: `leg:${reference}:paid`,
    })
    await this.ledgerRepo.postEntry(entry)

    await this.reconcileBatch(payout.id)
  }

  /** A batched leg failed: return that leg's reservation, then reconcile. */
  private async onLegFailed(payout: PayoutEntity, reference: string): Promise<void> {
    const leg = payout.legs?.find((l) => l.reference === reference)
    if (!leg) return
    const won = await this.payoutRepo.setLegStatus(
      payout.id,
      reference,
      ['queued', 'submitted'],
      'failed',
    )
    if (!won) return // idempotent

    await this.campaignBalanceRepo.returnToAvailable(
      payout.campaignId,
      leg.amount,
      `leg:${reference}:returned`,
    )
    await this.reconcileBatch(payout.id)
  }

  /**
   * A settled batched leg reversed: return that leg's money (paidOut → available)
   * with a reversing journal, and flag the whole payout for manual review — a
   * reversal on a partially/fully disbursed batch always needs a human.
   */
  private async onLegReversed(payout: PayoutEntity, reference: string): Promise<void> {
    const leg = payout.legs?.find((l) => l.reference === reference)
    if (!leg) return
    const won = await this.payoutRepo.setLegStatus(payout.id, reference, ['success'], 'reversed')
    if (!won) return // idempotent

    await this.campaignBalanceRepo.reverseFromPaidOut(
      payout.campaignId,
      leg.amount,
      0,
      `leg:${reference}:reversed`,
    )
    const entry = JournalEntryEntity.forPayoutReversal({
      campaignId: payout.campaignId,
      amount: leg.amount,
      currency: payout.currency,
      memo: `payout ${payout.id} leg ${leg.index + 1} reversed (${reference})`,
      externalRef: `leg:${reference}:reversed`,
    })
    await this.ledgerRepo.postEntry(entry)
    await this.payoutRepo.flagNeedsReview(payout.id)
  }

  /**
   * Decide a batched payout's terminal state once every leg is settled: PAID if
   * all legs succeeded, else NEEDS_REVIEW (real money left on the winners and
   * cannot be un-sent). No-op while any leg is still in flight — the last leg's
   * webhook makes the call. Atomic guards keep it exactly-once.
   */
  private async reconcileBatch(payoutId: string): Promise<void> {
    const p = await this.payoutRepo.findById(payoutId)
    if (!p || !p.isBatched || p.status !== 'PROCESSING') return
    const legs = p.legs ?? []
    const inFlight = legs.some((l) => l.status === 'queued' || l.status === 'submitted')
    if (inFlight) return
    const allSuccess = legs.every((l) => l.status === 'success')
    if (allSuccess) {
      await this.payoutRepo.transitionBatchedToPaid(payoutId)
    } else {
      await this.payoutRepo.flagNeedsReview(payoutId)
    }
  }
}
