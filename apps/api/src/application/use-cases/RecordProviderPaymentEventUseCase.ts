import type { DonationIntentRepositoryPort } from '../../domain/ports/outbound/DonationIntentRepositoryPort.js';
import type { DisputeRepositoryPort } from '../../domain/ports/outbound/DisputeRepositoryPort.js';
import type {
  ProviderPaymentEventRepositoryPort,
  ProviderPaymentSubject,
} from '../../domain/ports/outbound/ProviderPaymentEventRepositoryPort.js';
import type { RefundOperationRepositoryPort } from '../../domain/ports/outbound/RefundOperationRepositoryPort.js';
import { fromMinorUnits } from '../../domain/value-objects/Money.js';
import { logger } from '../../infrastructure/logging/logger.js';

type Data = Record<string, unknown>;

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : typeof value === 'number' ? String(value) : undefined;
const minor = (value: unknown): number | undefined => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isSafeInteger(n) && n >= 0 ? n : undefined;
};
const date = (value: unknown): Date | undefined => {
  const d = typeof value === 'string' || typeof value === 'number' ? new Date(value) : undefined;
  return d && !Number.isNaN(d.getTime()) ? d : undefined;
};

/**
 * Records chargebacks/disputes and refunds that a payment provider reports on
 * its own (Paystack `charge.dispute.*`, `refund.*`) — events Ujimora did not
 * initiate and previously dropped. Phase 1 of provider reversals: nothing here
 * moves money. Each event is stored once (replays are no-ops) and surfaced:
 *
 *  - a dispute on a campaign donation opens (or updates) a case in the staff
 *    Disputes queue, which also pauses automatic payouts for that campaign;
 *  - a processed refund on a campaign donation that no Ujimora refund operation
 *    requested (e.g. one issued from the provider dashboard) opens a case too,
 *    because the campaign balance was not reduced;
 *  - anything else (tips, subscriptions, wallet top-ups, unknown references) is
 *    recorded for the admin Provider events list and logged as an alert.
 *
 * Nothing here reverses balances. For a campaign case, staff record the
 * reversal the provider already made with the dispute's "Record provider
 * reversal" action (RecordProviderReversalUseCase): accounting only, never a
 * provider call. Staff must never answer these cases with a console refund —
 * that would send the donor a second, real refund. Non-campaign events have no
 * balance adjustment yet; staff handle them manually from the Provider events list.
 */
export class RecordProviderPaymentEventUseCase {
  constructor(
    private readonly events: ProviderPaymentEventRepositoryPort,
    private readonly intents: DonationIntentRepositoryPort,
    private readonly disputes: DisputeRepositoryPort,
    private readonly refundOperations: Pick<RefundOperationRepositoryPort, 'claimProviderRefund'>
  ) {}

  async handleDispute(event: string, data: Data): Promise<void> {
    const transaction = (data.transaction && typeof data.transaction === 'object' ? data.transaction : {}) as Data;
    const reference =
      text(transaction.reference) ?? text(data.transaction_reference) ?? text(data.merchant_transaction_reference);
    const caseId = text(data.id);
    if (!reference && !caseId) {
      logger.warn({ event }, 'paystack dispute event without a dispute id or transaction reference — ignored');
      return;
    }
    const currency = text(data.currency) ?? text(transaction.currency);
    const amountMinor = minor(data.refund_amount) || minor(transaction.amount);
    const providerStatus = text(data.status);
    const providerResolution = text(data.resolution);
    const dueAt = date(data.dueAt ?? data.due_at);
    const subject = await this.resolveSubject(reference);

    const { created } = await this.events.recordOnce({
      provider: 'paystack',
      event,
      kind: 'dispute',
      eventKey: ['paystack', event, caseId ?? reference, providerStatus ?? '', providerResolution ?? ''].join(':'),
      reference,
      subject: subject.subject,
      subjectId: subject.subjectId,
      campaignId: subject.campaignId,
      providerCaseId: caseId,
      amountMinor,
      currency,
      providerStatus,
      providerResolution,
    });
    if (created) {
      logger.error(
        { alert: 'provider_dispute', event, reference, disputeId: caseId, subject: subject.subject, campaignId: subject.campaignId, providerStatus, providerResolution },
        'paystack reported a payment dispute — needs staff attention'
      );
    }

    if (subject.subject !== 'donation' || !subject.campaignId || !reference) return;
    const amount = amountMinor !== undefined && currency ? fromMinorUnits(amountMinor, currency) : undefined;
    const closed = event === 'charge.dispute.resolve';
    await this.disputes.upsertProviderDispute({
      providerDisputeId: `paystack:dispute:${caseId ?? reference}`,
      source: 'paystack',
      campaignId: subject.campaignId,
      donationIntentId: subject.subjectId,
      transactionReference: reference,
      amount,
      currency,
      dueAt,
      providerStatus,
      providerResolution,
      providerClosed: closed,
      reason: 'Payment dispute (chargeback) raised with Paystack',
      description:
        `Paystack dispute ${caseId ?? '(no id)'} on transaction ${reference}` +
        (amount !== undefined ? ` for ${currency} ${amount.toFixed(2)}` : '') +
        (dueAt ? `; respond in the Paystack dashboard before ${dueAt.toISOString()}` : '') +
        '. Automatic payouts for this campaign stay paused while this case is open. ' +
        'Do NOT issue a refund from the console: if the donor gets the money back (e.g. resolution merchant-accepted), ' +
        'Paystack has already returned it. Use "Record provider reversal" on this case to take it out of the campaign ' +
        'balance (accounting only; no money moves). If the funds were already paid out, escalate to finance for a manual clawback.',
    });
  }

  async handleRefund(event: string, data: Data): Promise<void> {
    const reference = text(data.transaction_reference) ?? text(data.reference);
    if (!reference) {
      logger.warn({ event }, 'paystack refund event without a transaction reference — ignored');
      return;
    }
    const refundRef = text(data.refund_reference) ?? text(data.id);
    const amountMinor = minor(data.amount);
    const currency = text(data.currency);
    const providerStatus = text(data.status);
    const subject = await this.resolveSubject(reference);

    const { created } = await this.events.recordOnce({
      provider: 'paystack',
      event,
      kind: 'refund',
      eventKey: ['paystack', event, reference, refundRef ?? '', amountMinor ?? ''].join(':'),
      reference,
      subject: subject.subject,
      subjectId: subject.subjectId,
      campaignId: subject.campaignId,
      providerCaseId: refundRef,
      amountMinor,
      currency,
      providerStatus,
    });

    const processed = event === 'refund.processed' || event === 'charge.refund';
    if (!processed) return;
    // A refund Ujimora requested is accounted by its own refund operation. One
    // provider refund matches at most one operation, so a second refund of the
    // same amount (e.g. from the dashboard) still opens a case below.
    const providerRefundId = typeof data.id === 'number' || (typeof data.id === 'string' && /^\d{1,30}$/.test(data.id)) ? String(data.id) : undefined;
    const note = typeof data.merchant_note === 'string' ? /^Ujimora refund ([a-f0-9-]{36})$/.exec(data.merchant_note.trim()) : null;
    if (await this.refundOperations.claimProviderRefund({
      transactionReference: reference, amountMinor, providerRefundId, operationId: note?.[1], refundKey: refundRef,
    })) return;

    if (created) {
      logger.error(
        { alert: 'external_refund', event, reference, subject: subject.subject, campaignId: subject.campaignId, amountMinor, currency },
        'paystack processed a refund Ujimora did not request — balances were not reduced; needs staff accounting'
      );
    }
    // Upserted even on a redelivery, so a crash after recording the event
    // cannot leave the campaign without its case.
    if (subject.subject !== 'donation' || !subject.campaignId) return;
    const amount = amountMinor !== undefined && currency ? fromMinorUnits(amountMinor, currency) : undefined;
    await this.disputes.upsertProviderDispute({
      providerDisputeId: `paystack:refund:${reference}:${refundRef ?? amountMinor ?? ''}`,
      source: 'paystack',
      campaignId: subject.campaignId,
      donationIntentId: subject.subjectId,
      transactionReference: reference,
      amount,
      currency,
      providerStatus,
      reason: 'Refund issued outside Ujimora',
      description:
        `Paystack processed a refund` +
        (amount !== undefined ? ` of ${currency} ${amount.toFixed(2)}` : '') +
        ` on transaction ${reference} that no Ujimora refund requested (for example from the Paystack dashboard). ` +
        'The campaign balance has NOT been reduced. Do NOT issue another refund from the console: Paystack has already ' +
        'returned this money to the donor. Use "Record provider reversal" on this case to take it out of the campaign ' +
        'balance (accounting only; no money moves). If the funds were already paid out, escalate to finance for a manual ' +
        'clawback. Automatic payouts for this campaign stay paused while this case is open.',
    });
  }

  private async resolveSubject(
    reference: string | undefined
  ): Promise<{ subject: ProviderPaymentSubject; subjectId?: string; campaignId?: string }> {
    if (!reference) return { subject: 'unknown' };
    if (reference.startsWith('sub-')) return { subject: 'subscription' };
    if (reference.startsWith('tip-')) return { subject: 'tip' };
    if (reference.startsWith('wtop-')) return { subject: 'wallet_topup' };
    const intent = await this.intents.findByProviderRef(reference);
    return intent
      ? { subject: 'donation', subjectId: intent.id, campaignId: intent.campaignId }
      : { subject: 'unknown' };
  }
}
