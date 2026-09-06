import type { DonationIntentRepositoryPort } from '../../domain/ports/outbound/DonationIntentRepositoryPort.js';
import type { PaymentAttemptRepositoryPort } from '../../domain/ports/outbound/PaymentAttemptRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import type { FeePolicy } from '../services/FeePolicy.js';
import type { PlanLimitsService } from '../services/PlanLimitsService.js';
import type { SettleDonationUseCase } from './SettleDonationUseCase.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { logger } from '../../infrastructure/logging/logger.js';

export interface FlutterwaveWebhookInput {
  rawBody: Buffer;
  /** Value of the `verif-hash` header. */
  signature: string | undefined;
}

interface FlwWebhookData {
  tx_ref?: unknown;
  [key: string]: unknown;
}

interface FlwWebhookEvent {
  event?: string;
  data?: FlwWebhookData;
}

/**
 * Authoritative Flutterwave settlement. Verifies the `verif-hash` header, then —
 * because Flutterwave webhooks are thin and not individually signed per event —
 * RE-VERIFIES the transaction server-side by its `tx_ref` before doing anything
 * with money (spec §12). A verified success is correlated to its donation intent
 * and handed to the shared {@link SettleDonationUseCase} (idempotent), so a
 * replayed webhook can never double-credit. Provider currency + amount are
 * matched against the intent before crediting; a mismatch never credits.
 *
 * The FLW rail settles through the exact same domain seam as Paystack — the
 * campaign/ledger code stays provider-agnostic.
 */
export class HandleFlutterwaveWebhookUseCase {
  constructor(
    private readonly gateway: PaymentGatewayPort,
    private readonly donationIntentRepo: DonationIntentRepositoryPort,
    private readonly paymentAttemptRepo: PaymentAttemptRepositoryPort,
    private readonly feePolicy: FeePolicy,
    private readonly settleDonationUseCase: SettleDonationUseCase,
    private readonly planLimits: PlanLimitsService
  ) {}

  async execute(input: FlutterwaveWebhookInput): Promise<void> {
    if (!this.gateway.isConfigured()) {
      throw new AppError('Payments are not configured', 501);
    }
    if (!this.gateway.verifyWebhookSignature(input.rawBody, input.signature)) {
      throw new AppError('Invalid webhook signature', 401);
    }

    let event: FlwWebhookEvent;
    try {
      event = JSON.parse(input.rawBody.toString('utf8')) as FlwWebhookEvent;
    } catch {
      throw new AppError('Invalid webhook payload', 400);
    }

    const txRef =
      typeof event.data?.tx_ref === 'string' ? event.data.tx_ref : undefined;
    if (!txRef) return; // nothing to correlate — acknowledge and ignore

    // Flutterwave charge completion. Re-verify server-side; never trust the body.
    if (event.event === 'charge.completed' || event.event === 'charge.success') {
      await this.handleChargeCompleted(txRef);
    }
    // Other event types (transfers/refunds) are acknowledged; refunds/disputes
    // arrive in Phase 4.
  }

  private async handleChargeCompleted(txRef: string): Promise<void> {
    const intent = await this.donationIntentRepo.findByProviderRef(txRef);
    if (!intent) return; // unknown reference — safe no-op
    if (intent.status === 'SUCCEEDED') return; // idempotent
    if (intent.status === 'FAILED' || intent.status === 'EXPIRED') return;

    // Server-side re-verification is the source of truth (spec §12).
    const verified = await this.gateway.verifyTransaction(txRef);
    if (verified.status !== 'success') {
      await this.donationIntentRepo.updateStatus(intent.id, 'FAILED', txRef);
      await this.safeRecordAttempt(intent.id, txRef, 'failed', verified.raw);
      return;
    }

    // Match provider currency + amount against the intent before crediting.
    const currencyMismatch =
      verified.currency.toUpperCase() !== intent.currency.toUpperCase();
    const amountMismatch = Math.abs(verified.amount - intent.gross) > 0.01;
    if (currencyMismatch || amountMismatch) {
      logger.warn(
        {
          intentId: intent.id,
          providerRef: txRef,
          expectedCurrency: intent.currency,
          providerCurrency: verified.currency,
          expectedGross: intent.gross,
          providerGross: verified.amount,
        },
        'flutterwave settlement mismatch — not crediting; flagged for reconciliation'
      );
      await this.safeRecordAttempt(intent.id, txRef, 'failed', verified.raw);
      return;
    }

    const platformFeePercent =
      await this.planLimits.platformFeePercentForCampaign(intent.campaignId);
    const breakdown = this.feePolicy.computeSettlementFromProvider({
      gross: verified.amount,
      tip: intent.tip,
      processorFee: verified.fees,
      currency: verified.currency,
      providerRef: txRef,
      platformFeePercent,
    });

    await this.settleDonationUseCase.execute(intent, breakdown);
    await this.safeRecordAttempt(intent.id, txRef, 'succeeded', verified.raw);
  }

  private async safeRecordAttempt(
    intentId: string,
    providerRef: string,
    status: 'succeeded' | 'failed',
    raw: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.paymentAttemptRepo.record({
        intentId,
        provider: 'flutterwave',
        providerRef,
        status,
        raw,
      });
    } catch (error) {
      logger.error(
        { err: error, intentId },
        'failed to record flutterwave payment attempt'
      );
    }
  }
}
