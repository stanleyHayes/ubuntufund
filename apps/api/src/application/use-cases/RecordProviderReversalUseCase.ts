import type { DisputeRecord, DisputeRepositoryPort } from '../../domain/ports/outbound/DisputeRepositoryPort.js';
import type { ProcessRefundResult, ProcessRefundUseCase } from './ProcessRefundUseCase.js';
import { providerCaseKind } from './GetDisputeUseCase.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface RecordProviderReversalRequest {
  /** Campaign-directed amount (major units); defaults to the case amount, capped at what is still refundable. */
  amount?: number;
}

/**
 * The staff action for a provider case (a chargeback, or a refund issued in
 * the provider dashboard): record the money the provider already returned so
 * the campaign balance, ledger and contribution status match. It never calls
 * the provider — a console refund here would pay the donor a second time.
 * Keyed on the case's provider id, so it is recorded at most once.
 */
export class RecordProviderReversalUseCase {
  constructor(
    private readonly disputes: Pick<DisputeRepositoryPort, 'findById' | 'linkReversal'>,
    private readonly refunds: Pick<ProcessRefundUseCase, 'recordProviderReversal'>
  ) {}

  async execute(
    disputeId: string,
    input: RecordProviderReversalRequest,
    adminId: string
  ): Promise<{ dispute: DisputeRecord; reversal: ProcessRefundResult }> {
    const dispute = await this.disputes.findById(disputeId);
    if (!dispute) throw new AppError('Dispute not found', 404);
    const kind = providerCaseKind(dispute);
    if (!kind || !dispute.providerDisputeId || !dispute.donationIntentId || !dispute.transactionReference) {
      throw new AppError('Only a payment-provider case on a campaign donation can record a provider reversal', 400);
    }
    if (dispute.status === 'resolved' || dispute.status === 'dismissed') {
      throw new AppError('This case is closed', 409);
    }
    const reversal = await this.refunds.recordProviderReversal(
      dispute.donationIntentId,
      {
        providerEventKey: dispute.providerDisputeId,
        kind: kind === 'chargeback' ? 'chargeback' : 'refund',
        transactionReference: dispute.transactionReference,
        amount: input.amount,
        providerAmount: dispute.amount,
        providerCurrency: dispute.currency,
      },
      adminId
    );
    // Link only once the accounting committed; a pending local reversal is
    // retried by running this action again (same key, same operation).
    if (reversal.status === 'PENDING_REVIEW' || reversal.status === 'PROCESSING') {
      return { dispute, reversal };
    }
    const linked = await this.disputes.linkReversal(dispute.id, reversal.operationId);
    return { dispute: linked ?? dispute, reversal };
  }
}
