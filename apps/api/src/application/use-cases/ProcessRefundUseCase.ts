import { randomUUID } from 'node:crypto';
import type { RefundOperation, RefundOperationRepositoryPort } from '../../domain/ports/outbound/RefundOperationRepositoryPort.js';
import type { UnitOfWorkPort } from '../../domain/ports/outbound/UnitOfWorkPort.js';
import type { RefundFundsPort } from '../../domain/ports/outbound/RefundFundsPort.js';
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
  /** Campaign-directed amount in MAJOR units; omit for the full campaign amount, excluding the separate platform tip. */
  amount?: number;
  /**
   * Idempotency key for this refund request (e.g. an `Idempotency-Key` header).
   * The local reservation rejects a repeated key. A completed full campaign
   * refund reaches terminal REFUNDED. Ambiguous provider outcomes and recovery
   * still need reconciliation; this key is not provider-level exactly-once proof.
   */
  idempotencyKey?: string;
}

export interface ProcessRefundResult {
  status: 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'PROCESSING' | 'PENDING_REVIEW';
  operationId: string;
  refundReference?: string;
  amount: number;
}

/**
 * Admin-initiated, provider-integrated refund of a settled contribution (spec
 * §14). It: verifies the contribution is refundable, checks the funds are still
 * pending (never claws back already-disbursed money — those need manual
 * handling), refunds at the provider, reverses the campaign projection, posts a
 * balanced COMPENSATING ledger entry (the original settlement is never edited),
 * and transitions the intent to REFUNDED / PARTIALLY_REFUNDED. The local state and
 * balance guards cap cumulative reservations; see REFUNDS_AND_FEES.md for the
 * remaining asynchronous-provider and recovery limitations.
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
    private readonly gatewayRegistry: Map<string, PaymentGatewayPort>,
    private readonly operationRepo: RefundOperationRepositoryPort,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly refundFunds: RefundFundsPort
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
    const currency = (intent.settlementCurrency ?? intent.currency).toUpperCase();
    if (currency !== intent.currency.toUpperCase()) {
      throw new AppError('Refunds involving currency conversion require manual reconciliation', 409);
    }
    const roundCur = (n: number): number => {
      const factor = 10 ** minorUnitExponent(currency);
      return Math.round(n * factor) / factor;
    };

    const fullAmount = roundCur(intent.amount);
    const refundAmount = roundCur(input.amount ?? fullAmount);
    if (!Number.isFinite(refundAmount) || !Number.isFinite(fullAmount) || refundAmount <= 0 || refundAmount > fullAmount) {
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

    // Early feedback only. The transactional funds hold below is authoritative
    // when a payout clears funds after this read.
    const balance = await this.campaignBalanceRepo.findByCampaignId(intent.campaignId);
    if (!balance || balance.pendingBalance + 1e-6 < beneficiaryNet) {
      throw new AppError(
        'These funds appear already disbursed; a manual clawback is required',
        409
      );
    }

    // A durable attempt and its cumulative reservation commit before the one
    // external call. An unresolved attempt blocks every new key for this intent.
    if (await this.operationRepo.findActiveByIntentId(intent.id)) {
      throw new AppError('An earlier refund needs reconciliation before another refund can be submitted', 409);
    }
    const operationId = randomUUID();
    const requestKey = input.idempotencyKey ?? operationId;
    let operation!: RefundOperation;
    try {
      await this.unitOfWork.run(async () => {
        const claimed = await this.donationIntentRepo.claimRefund(intent.id, amountMinor, maxMinor, requestKey);
        if (!claimed) throw new AppError('This refund was already processed or would exceed the refundable amount', 409);
        operation = {
          id: operationId, intentId: intent.id, campaignId: intent.campaignId,
          provider: intent.provider, transactionReference: intent.providerRef!,
          requestKey, adminId, amount: refundAmount, amountMinor,
          cumulativeMinor: claimed.refundedAmountMinor ?? amountMinor, maxMinor,
          currency, beneficiaryNet, platformFee, processorFee,
          state: 'submitting', active: true, createdAt: new Date(), updatedAt: new Date(),
        };
        operation.beneficiaryHolds = await this.refundFunds.reserve(operation);
        operation.fundsHoldVersion = 1;
        await this.operationRepo.create(operation);
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new AppError('This refund was already submitted or an earlier refund needs reconciliation', 409);
      }
      throw error;
    }

    let refund;
    try {
      refund = await gateway.refundPayment(intent.providerRef, refundAmount, intent.currency, operationId);
    } catch (error) {
      // A timeout is not proof that no money moved. Never release or resubmit.
      await this.operationRepo.update(operationId, ['submitting'], { state: 'provider_unknown', issue: 'provider_unconfirmed' });
      logger.error({ err: error, operationId }, 'refund provider outcome requires review');
      return { status: 'PENDING_REVIEW', operationId, amount: refundAmount };
    }
    const status = typeof refund.status === 'string' ? refund.status.toLowerCase() : 'unknown';
    if (status !== 'processed' || !refund.reference) {
      const state = status === 'failed' ? 'provider_failed' : ['pending', 'processing'].includes(status) ? 'provider_pending' : 'provider_unknown';
      await this.operationRepo.update(operationId, ['submitting'], {
        state, providerReference: refund.reference,
        issue: state === 'provider_failed' ? 'provider_failed' : state === 'provider_pending' ? 'provider_pending' : 'provider_unconfirmed',
      });
      return { status: state === 'provider_pending' ? 'PROCESSING' : 'PENDING_REVIEW', operationId, refundReference: refund.reference, amount: refundAmount };
    }
    await this.operationRepo.update(operationId, ['submitting'], { state: 'provider_pending', providerReference: refund.reference });
    try { return await this.verifyProviderOutcome(operationId); }
    catch (error) {
      await this.operationRepo.update(operationId, ['provider_pending'], { issue: 'provider_unconfirmed' });
      logger.error({ err: error, operationId }, 'refund confirmation requires review');
      return { status: 'PENDING_REVIEW', operationId, amount: refundAmount, refundReference: refund.reference };
    }
  }

  /** Read-only provider calls; never initiates or retries a provider refund. */
  async verifyProviderOutcome(operationId: string, suppliedReference?: string): Promise<ProcessRefundResult> {
    const operation = await this.operationRepo.findById(operationId);
    if (!operation) throw new AppError('Refund operation not found', 404);
    if (operation.state === 'completed' || operation.state === 'reversal_pending') return this.finishLocalReversal(operationId);
    if (suppliedReference && operation.providerReference && suppliedReference !== operation.providerReference) {
      throw new AppError('The refund reference does not match this operation', 409);
    }
    const reference = operation.providerReference ?? suppliedReference;
    if (!reference) throw new AppError('Provide the original provider refund ID to verify this operation', 400);
    const gateway = this.gatewayRegistry.get(operation.provider);
    if (!gateway?.isConfigured() || !gateway.fetchRefund) throw new AppError('Provider refund verification is unavailable', 503);
    const verified = await gateway.fetchRefund(reference);
    const transaction = await gateway.verifyTransaction(operation.transactionReference);
    if (verified.reference !== reference || verified.operationReference !== operation.id ||
      verified.amountMinor !== operation.amountMinor || verified.currency !== operation.currency ||
      transaction.reference !== operation.transactionReference || transaction.currency !== operation.currency ||
      verified.transactionId !== String(transaction.raw.id)) {
      throw new AppError('Provider evidence does not match this refund operation', 409);
    }
    const expected = ['submitting', 'provider_pending', 'provider_unknown', 'provider_failed'] as const;
    if (verified.status === 'processed') {
      const updated = await this.operationRepo.update(operationId, [...expected], { state: 'reversal_pending', providerReference: reference });
      if (!updated) {
        const latest = await this.operationRepo.findById(operationId);
        if (latest?.providerReference !== reference || !['reversal_pending', 'completed'].includes(latest.state)) throw new AppError('Refund operation changed; refresh before retrying', 409);
      }
      return this.finishLocalReversal(operationId);
    }
    const state = verified.status === 'failed' ? 'provider_failed' : ['pending', 'processing'].includes(verified.status) ? 'provider_pending' : 'provider_unknown';
    const updated = await this.operationRepo.update(operationId, [...expected], { state, providerReference: reference,
      issue: state === 'provider_failed' ? 'provider_failed' : state === 'provider_pending' ? 'provider_pending' : 'provider_unconfirmed' });
    if (!updated) throw new AppError('Refund operation changed; refresh before retrying', 409);
    return { operationId, amount: operation.amount, refundReference: reference, status: state === 'provider_pending' ? 'PROCESSING' : 'PENDING_REVIEW' };
  }

  async listUnresolved(page = 1) {
    const result = await this.operationRepo.listUnresolved(page);
    return { ...result, page, pageSize: 25, items: result.items.map(({ requestKey: _key, ...operation }) => operation) };
  }

  /** This retry never contacts a payment provider or creates another refund. */
  async finishLocalReversal(operationId: string): Promise<ProcessRefundResult> {
    const current = await this.operationRepo.findById(operationId);
    if (!current) throw new AppError('Refund operation not found', 404);
    if (current.state !== 'reversal_pending' && current.state !== 'completed') {
      throw new AppError('Verify the provider outcome before completing local accounting', 409);
    }
    try {
      return await this.unitOfWork.run(async () => {
        const operation = await this.operationRepo.findById(operationId);
        if (!operation) throw new AppError('Refund operation not found', 404);
        const result: ProcessRefundResult = {
          operationId, amount: operation.amount, refundReference: operation.providerReference,
          status: operation.cumulativeMinor < operation.maxMinor ? 'PARTIALLY_REFUNDED' : 'REFUNDED',
        };
        if (operation.state === 'completed') return result;
        if (!(await this.operationRepo.update(operationId, ['reversal_pending'], { state: 'completed', active: false }))) {
          throw new AppError('Refund operation changed; refresh its status', 409);
        }
        await this.refundFunds.restoreForReversal(operation);
        const reversed = await this.projector.reverseDonation(operation.campaignId, operation.currency, {
          amount: operation.amount, beneficiaryNet: operation.beneficiaryNet,
          platformFee: operation.platformFee, processorFee: operation.processorFee,
        }, operation.intentId);
        if (!reversed) throw new AppError('Refund requires manual balance reconciliation', 409);
        await this.ledgerRepo.postEntry(JournalEntryEntity.forDonationRefund({
          campaignId: operation.campaignId, externalRef: `refund:${operation.id}`, amount: operation.amount,
          beneficiaryNet: operation.beneficiaryNet, platformFee: operation.platformFee,
          processorFee: operation.processorFee, currency: operation.currency,
          memo: `refund operation ${operation.id} by admin ${operation.adminId} for intent ${operation.intentId}`,
        }));
        await this.donationIntentRepo.updateStatus(operation.intentId, result.status === 'REFUNDED' ? 'REFUNDED' : 'PARTIALLY_REFUNDED', operation.transactionReference);
        return result;
      });
    } catch (error) {
      await this.operationRepo.update(operationId, ['reversal_pending'], { issue: 'local_reversal_failed' });
      logger.error({ err: error, operationId }, 'refund local accounting remains pending');
      return { status: 'PENDING_REVIEW', operationId, amount: current.amount, refundReference: current.providerReference };
    }
  }
}
