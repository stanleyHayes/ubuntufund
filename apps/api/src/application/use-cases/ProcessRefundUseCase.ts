import { JournalEntryEntity } from '../../domain/entities/JournalEntry.js';
import { fromMinorUnits } from '../../domain/value-objects/Money.js';
import type { DonationIntentRepositoryPort } from '../../domain/ports/outbound/DonationIntentRepositoryPort.js';
import type { CampaignBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBalanceRepositoryPort.js';
import type { LedgerRepositoryPort } from '../../domain/ports/outbound/LedgerRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import type { CampaignLedgerProjector } from '../services/CampaignLedgerProjector.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { logger } from '../../infrastructure/logging/logger.js';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ProcessRefundInput {
  /** Refunded campaign-directed amount in MAJOR units; omit for a full refund. */
  amount?: number;
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

    const fullAmount = intent.amount;
    const refundAmount = round2(input.amount ?? fullAmount);
    if (refundAmount <= 0 || refundAmount > fullAmount) {
      throw new AppError('Refund amount must be between 0 and the contribution amount', 400);
    }
    const isPartial = refundAmount < fullAmount;

    // Split the refunded amount into net/fee legs, proportional to the recorded
    // settlement, so the compensating entry balances and the buckets unwind.
    const currency = intent.settlementCurrency ?? intent.currency;
    const settledNet =
      intent.netCampaignAmountMinor !== undefined
        ? fromMinorUnits(intent.netCampaignAmountMinor, currency)
        : fullAmount;
    const settledPlatformFee =
      intent.platformFeeMinor !== undefined
        ? fromMinorUnits(intent.platformFeeMinor, currency)
        : 0;
    const fraction = refundAmount / fullAmount;
    const beneficiaryNet = round2(settledNet * fraction);
    const platformFee = round2(settledPlatformFee * fraction);
    // Absorb rounding into the processor-fee leg so amount === net+platform+processor.
    const processorFee = round2(refundAmount - beneficiaryNet - platformFee);

    // Guard: only refund funds still pending (not disbursed) — check before we
    // touch the provider, so we never refund money we can't reverse locally.
    const balance = await this.campaignBalanceRepo.findByCampaignId(intent.campaignId);
    if (!balance || balance.pendingBalance + 1e-6 < beneficiaryNet) {
      throw new AppError(
        'These funds appear already disbursed; a manual clawback is required',
        409
      );
    }

    // 1. Refund at the provider (real money movement).
    const refund = await gateway.refundPayment(
      intent.providerRef,
      isPartial ? refundAmount : undefined,
      intent.currency
    );

    // 2. Reverse the campaign projection (guarded again for the race).
    const reversed = await this.projector.reverseDonation(intent.campaignId, currency, {
      amount: refundAmount,
      beneficiaryNet,
      platformFee,
      processorFee,
    });
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

    // 3. Post the balanced compensating journal (append-only; NOT keyed on the
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

    // 4. Transition the intent (full → REFUNDED terminal; part → PARTIALLY_REFUNDED).
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
