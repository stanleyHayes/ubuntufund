import { JournalEntryEntity } from '../../domain/entities/JournalEntry.js';
import {
  fromMinorUnits,
  minorUnitExponent,
  toMinorUnits,
} from '../../domain/value-objects/Money.js';
import type { DonationIntentRepositoryPort } from '../../domain/ports/outbound/DonationIntentRepositoryPort.js';
import type { CampaignBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBalanceRepositoryPort.js';
import type { LedgerRepositoryPort } from '../../domain/ports/outbound/LedgerRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import type { CampaignLedgerProjector } from '../services/CampaignLedgerProjector.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { logger } from '../../infrastructure/logging/logger.js';

export interface ProcessRefundInput {
  /** Refunded campaign-directed amount in MAJOR units; omit for a full refund. */
  amount?: number;
  /**
   * Idempotency key for this refund request (e.g. an `Idempotency-Key` header).
   * When supplied, a repeated request with the same key is an exact no-op — the
   * only way to make a *partial* refund fully retry-safe. A full refund is
   * already idempotent without it (it lands the intent in terminal REFUNDED).
   */
  idempotencyKey?: string;
}

export interface ProcessRefundResult {
  status: 'REFUNDED' | 'PARTIALLY_REFUNDED';
  refundReference?: string;
  amount: number;
}

/**
 * Admin-initiated, provider-integrated refund of a settled contribution (spec
 * §14). It: verifies the contribution is refundable, checks the funds are still
 * pending (never claws back already-disbursed money — those need manual
 * handling), refunds at the provider, reverses the campaign projection, posts a
 * balanced COMPENSATING ledger entry (the original settlement is never edited),
 * and transitions the intent to REFUNDED / PARTIALLY_REFUNDED. The state machine
 * + the pending-balance guard make a repeated refund safe.
 *
 * Fee treatment (which fees are returned) is a §10 accountant-review policy; the
 * engineering guarantee is a balanced, auditable, append-only reversal.
 */
export class ProcessRefundUseCase {
  constructor(
    private readonly donationIntentRepo: DonationIntentRepositoryPort,
    private readonly campaignBalanceRepo: CampaignBalanceRepositoryPort,
    private readonly ledgerRepo: LedgerRepositoryPort,
    private readonly projector: CampaignLedgerProjector,
    private readonly gatewayRegistry: Map<string, PaymentGatewayPort>
  ) {}

  async execute(
    intentId: string,
    input: ProcessRefundInput,
    adminId: string
  ): Promise<ProcessRefundResult> {
    const intent = await this.donationIntentRepo.findById(intentId);
    if (!intent) throw new AppError('Contribution not found', 404);
    if (intent.status !== 'SUCCEEDED' && intent.status !== 'PARTIALLY_REFUNDED') {
      throw new AppError('Only a settled contribution can be refunded', 400);
    }
    if (!intent.providerRef) {
      throw new AppError('Contribution has no provider reference to refund', 400);
    }
    const gateway = this.gatewayRegistry.get(intent.provider);
    if (!gateway || !gateway.isConfigured()) {
      throw new AppError(`Refunds are not available for ${intent.provider}`, 501);
    }

    // All money math is in the settlement currency at its own minor-unit
    // precision — never a hardcoded 2dp.
    const currency = intent.settlementCurrency ?? intent.currency;
    const roundCur = (n: number): number => {
      const factor = 10 ** minorUnitExponent(currency);
      return Math.round(n * factor) / factor;
    };

    const fullAmount = roundCur(intent.amount);
    const refundAmount = roundCur(input.amount ?? fullAmount);
    if (refundAmount <= 0 || refundAmount > fullAmount) {
      throw new AppError('Refund amount must be between 0 and the contribution amount', 400);
    }

    const maxMinor = toMinorUnits(fullAmount, currency);
    const amountMinor = toMinorUnits(refundAmount, currency);

    // Split the refunded amount into net/fee legs, proportional to the recorded
    // settlement, so the compensating entry balances and the buckets unwind.
    const settledNet =
      intent.netCampaignAmountMinor !== undefined
        ? fromMinorUnits(intent.netCampaignAmountMinor, currency)
        : fullAmount;
    const settledPlatformFee =
      intent.platformFeeMinor !== undefined
        ? fromMinorUnits(intent.platformFeeMinor, currency)
        : 0;
    const fraction = refundAmount / fullAmount;
    const beneficiaryNet = roundCur(settledNet * fraction);
    const platformFee = roundCur(settledPlatformFee * fraction);
    // Absorb rounding into the processor-fee leg so amount === net+platform+processor.
    const processorFee = roundCur(refundAmount - beneficiaryNet - platformFee);

    // Guard: only refund funds still pending (not disbursed) — check before we
    // touch the provider, so we never refund money we can't reverse locally.
    const balance = await this.campaignBalanceRepo.findByCampaignId(intent.campaignId);
    if (!balance || balance.pendingBalance + 1e-6 < beneficiaryNet) {
      throw new AppError(
        'These funds appear already disbursed; a manual clawback is required',
        409
      );
    }

    // 1. ATOMIC CLAIM before any provider call — reserves this refund against the
    //    intent and caps the cumulative total at the original amount. A retried
    //    request (same key) or an over-refund is rejected here, so the provider
    //    is never asked to refund twice.
    const claimed = await this.donationIntentRepo.claimRefund(
      intent.id,
      amountMinor,
      maxMinor,
      input.idempotencyKey
    );
    if (!claimed) {
      throw new AppError(
        'This refund was already processed or would exceed the refundable amount',
        409
      );
    }
    const cumulativeMinor = claimed.refundedAmountMinor ?? amountMinor;
    const isPartial = cumulativeMinor < maxMinor;
    // A single full refund (this leg is the whole original, nothing refunded
    // before) tells the provider to do a full refund (undefined amount);
    // anything else is an explicit partial-amount refund.
    const isSingleFullRefund = amountMinor === maxMinor && cumulativeMinor === maxMinor;

    let refund: { reference?: string };
    try {
      // 2. Refund at the provider (real money movement).
      refund = await gateway.refundPayment(
        intent.providerRef,
        isSingleFullRefund ? undefined : refundAmount,
        intent.currency
      );
    } catch (error) {
      // Provider call failed — release the reservation so the amount is
      // refundable again, then surface the error.
      await this.donationIntentRepo.releaseRefundClaim(
        intent.id,
        amountMinor,
        input.idempotencyKey
      );
      throw error;
    }

    // 3. Reverse the campaign projection (guarded again for the race). If this is
    //    blocked, the money already moved at the provider — do NOT release the
    //    claim; flag for manual reconciliation instead.
    const reversed = await this.projector.reverseDonation(
      intent.campaignId,
      currency,
      { amount: refundAmount, beneficiaryNet, platformFee, processorFee },
      intent.id
    );
    if (!reversed) {
      logger.error(
        { intentId: intent.id, providerRef: intent.providerRef, refundRef: refund.reference },
        'refund processed at provider but local reversal was blocked — needs manual reconciliation'
      );
      throw new AppError(
        'Refund initiated at the provider but funds were already disbursed; flagged for manual reconciliation',
        409
      );
    }

    // 4. Post the balanced compensating journal (append-only; NOT keyed on the
    // intent id, so it never collapses into the original settlement entry).
    await this.ledgerRepo.postEntry(
      JournalEntryEntity.forDonationRefund({
        campaignId: intent.campaignId,
        amount: refundAmount,
        beneficiaryNet,
        platformFee,
        processorFee,
        currency,
        memo: `refund by admin ${adminId} for intent ${intent.id} (provider ref ${refund.reference ?? intent.providerRef})`,
      })
    );

    // 5. Transition the intent (fully refunded → REFUNDED terminal; otherwise
    // PARTIALLY_REFUNDED). Cumulative total decides, not this single leg.
    await this.donationIntentRepo.updateStatus(
      intent.id,
      isPartial ? 'PARTIALLY_REFUNDED' : 'REFUNDED',
      intent.providerRef
    );

    logger.info(
      {
        intentId: intent.id,
        adminId,
        provider: intent.provider,
        refundAmount,
        isPartial,
        refundReference: refund.reference,
      },
      'contribution refunded'
    );

    return {
      status: isPartial ? 'PARTIALLY_REFUNDED' : 'REFUNDED',
      refundReference: refund.reference,
      amount: refundAmount,
    };
  }
}
