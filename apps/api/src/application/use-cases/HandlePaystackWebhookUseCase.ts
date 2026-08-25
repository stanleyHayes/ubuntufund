import type { DonationIntentRepositoryPort } from '../../domain/ports/outbound/DonationIntentRepositoryPort.js';
import type { PaymentAttemptRepositoryPort } from '../../domain/ports/outbound/PaymentAttemptRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import type { FeePolicy } from '../services/FeePolicy.js';
import type { SettleDonationUseCase } from './SettleDonationUseCase.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { logger } from '../../infrastructure/logging/logger.js';

export interface PaystackWebhookInput {
  /** The exact raw request bytes the signature was computed over. */
  rawBody: Buffer;
  /** Value of the `x-paystack-signature` header. */
  signature: string | undefined;
}

/** The Paystack charge fields the settlement reads. */
interface PaystackChargeData {
  reference?: unknown;
  amount?: unknown;
  fees?: unknown;
  currency?: unknown;
  [key: string]: unknown;
}

interface PaystackWebhookEvent {
  event?: string;
  data?: PaystackChargeData;
}

/**
 * Authoritative Paystack settlement. Verifies the webhook's HMAC signature over
 * the raw body, then acts on the event:
 *
 *  - `charge.success` → correlate the intent by its provider reference, build a
 *    {@link DonationSettlementBreakdown} from Paystack's real gross + processor
 *    fee, and hand off to {@link SettleDonationUseCase} (which posts the
 *    immutable ledger journal, projects the campaign total + beneficiary
 *    balance, and dispatches realtime/receipt side-effects). Idempotent — a
 *    duplicate reference for an already-SUCCEEDED intent is a no-op.
 *  - `charge.failed` → mark the intent FAILED (unless already settled).
 *  - anything else → ignored.
 *
 * The frontend callback is never trusted as proof of payment; only this signed
 * webhook settles money.
 */
export class HandlePaystackWebhookUseCase {
  constructor(
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly donationIntentRepo: DonationIntentRepositoryPort,
    private readonly paymentAttemptRepo: PaymentAttemptRepositoryPort,
    private readonly feePolicy: FeePolicy,
    private readonly settleDonationUseCase: SettleDonationUseCase
  ) {}

  async execute(input: PaystackWebhookInput): Promise<void> {
    if (!this.paymentGateway.isConfigured()) {
      throw new AppError('Payments are not configured', 501);
    }
    if (!this.paymentGateway.verifyWebhookSignature(input.rawBody, input.signature)) {
      throw new AppError('Invalid webhook signature', 401);
    }

    let event: PaystackWebhookEvent;
    try {
      event = JSON.parse(input.rawBody.toString('utf8')) as PaystackWebhookEvent;
    } catch {
      throw new AppError('Invalid webhook payload', 400);
    }

    const data = event.data ?? {};
    const reference =
      typeof data.reference === 'string' ? data.reference : undefined;
    // No reference to correlate — acknowledge and ignore.
    if (!reference) return;

    switch (event.event) {
      case 'charge.success':
        await this.handleChargeSuccess(reference, data);
        return;
      case 'charge.failed':
        await this.handleChargeFailed(reference, data);
        return;
      default:
        // Unhandled event type — acknowledge without acting.
        return;
    }
  }

  private async handleChargeSuccess(
    reference: string,
    data: PaystackChargeData
  ): Promise<void> {
    const intent = await this.donationIntentRepo.findByProviderRef(reference);
    // Unknown reference (or already terminal) — ack and ignore. The settlement
    // gate in SettleDonationUseCase is the ultimate exactly-once guard.
    if (!intent) return;
    if (intent.status === 'SUCCEEDED') return;
    if (intent.status === 'FAILED' || intent.status === 'EXPIRED') return;

    const gross = (Number(data.amount) || 0) / 100;
    const processorFee = (Number(data.fees) || 0) / 100;
    const currency =
      typeof data.currency === 'string' ? data.currency : intent.currency;

    const breakdown = this.feePolicy.computeSettlementFromProvider({
      gross,
      tip: intent.tip,
      processorFee,
      currency,
      providerRef: reference,
    });

    await this.settleDonationUseCase.execute(intent, breakdown);

    // Record the successful attempt (best-effort; never fails the settlement).
    try {
      await this.paymentAttemptRepo.record({
        intentId: intent.id,
        provider: 'paystack',
        providerRef: reference,
        status: 'succeeded',
        raw: data as Record<string, unknown>,
      });
    } catch (error) {
      logger.error(
        { err: error, intentId: intent.id },
        'failed to record paystack success attempt'
      );
    }
  }

  private async handleChargeFailed(
    reference: string,
    data: PaystackChargeData
  ): Promise<void> {
    const intent = await this.donationIntentRepo.findByProviderRef(reference);
    if (!intent) return;
    // Never override a settled intent, and don't re-fail a terminal one.
    if (intent.status === 'SUCCEEDED') return;
    if (intent.status === 'FAILED' || intent.status === 'EXPIRED') return;

    await this.donationIntentRepo.updateStatus(intent.id, 'FAILED', reference);

    try {
      await this.paymentAttemptRepo.record({
        intentId: intent.id,
        provider: 'paystack',
        providerRef: reference,
        status: 'failed',
        raw: data as Record<string, unknown>,
      });
    } catch (error) {
      logger.error(
        { err: error, intentId: intent.id },
        'failed to record paystack failure attempt'
      );
    }
  }
}
