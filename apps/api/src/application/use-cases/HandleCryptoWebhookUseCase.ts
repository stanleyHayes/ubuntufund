import { cryptoToMinor } from '../services/cryptoMoney.js';
import type { CryptoWebhookEvent } from '@ubuntu-fund/types';
import type { DonationIntentEntity } from '../../domain/entities/DonationIntent.js';
import type { CryptoPaymentProviderPort } from '../../domain/ports/outbound/CryptoPaymentProviderPort.js';
import type { CryptoWebhookEventRepositoryPort } from '../../domain/ports/outbound/CryptoWebhookEventRepositoryPort.js';
import type { DonationIntentRepositoryPort } from '../../domain/ports/outbound/DonationIntentRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { FeePolicy } from '../services/FeePolicy.js';
import type { PlanLimitsService } from '../services/PlanLimitsService.js';
import type { SettleDonationUseCase } from './SettleDonationUseCase.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export type CryptoWebhookOutcome = 'ok' | 'duplicate' | 'ignored';

/**
 * Settles crypto provider webhooks (Crypto Donations plan §7/§8). The single
 * source of truth is Ujimora's normalized state, not the provider payload:
 *   1. Verify the signature (adapter) — an invalid signature is a 401.
 *   2. Dedup on (provider, eventId) — a replay is skipped (never double-credits).
 *   3. Correlate to the crypto intent by our providerRef.
 *   4. detected → PROCESSING; confirmed (final) → settle via the shared
 *      {@link SettleDonationUseCase} (the exactly-once gate); failed → FAILED.
 * Only a CONFIRMED deposit increments the campaign total, and the GHS-equivalent
 * (locked at deposit) is what credits it — never a re-quoted rate (§9).
 */
export class HandleCryptoWebhookUseCase {
  constructor(
    private readonly providersByName: Map<string, CryptoPaymentProviderPort>,
    private readonly intentRepo: DonationIntentRepositoryPort,
    private readonly webhookEventRepo: CryptoWebhookEventRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly feePolicy: FeePolicy,
    private readonly planLimits: PlanLimitsService,
    private readonly settleDonationUseCase: SettleDonationUseCase
  ) {}

  async handle(
    providerName: string,
    headers: Record<string, string | string[] | undefined>,
    rawBody: string
  ): Promise<CryptoWebhookOutcome> {
    const provider = this.providersByName.get(providerName);
    if (!provider) throw new AppError('Unknown crypto provider', 404);

    const event = await provider.verifyWebhook(headers, rawBody);
    if (!event) throw new AppError('Invalid crypto webhook signature', 401);

    const intent = await this.intentRepo.findByProviderRef(event.providerRef);
    if (!intent || intent.paymentRail !== 'CRYPTO') throw new AppError('Crypto intent not ready; retry webhook', 503);
    if (intent.provider !== providerName) throw new AppError('Crypto provider mismatch', 409);
    // Settlement is idempotent. Record delivery only AFTER success so failures can retry.
    await this.applyEvent(intent, event);
    const fresh = await this.webhookEventRepo.recordIfNew(providerName, event.eventId, event.type);
    if (!fresh) return 'duplicate';
    return 'ok';
  }

  /** Apply a normalized event to a crypto intent (shared by webhook + reconcile). */
  async applyEvent(
    intent: DonationIntentEntity,
    event: CryptoWebhookEvent
  ): Promise<void> {
    switch (event.type) {
      case 'deposit.detected':
        await this.intentRepo.markCryptoProcessing(intent.id, {
          transactionHash: event.transactionHash,
          confirmationCount: event.confirmations,
        });
        return;
      case 'deposit.confirmed':
        await this.confirm(intent, event);
        return;
      case 'deposit.failed':
        await this.intentRepo.markFailedIfPending(intent.id);
        return;
    }
  }

  /** Settle a confirmed deposit once it reaches the required finality (§7). */
  private async confirm(
    intent: DonationIntentEntity,
    event: CryptoWebhookEvent
  ): Promise<void> {
    if (intent.provider !== 'mock' && (event.cryptoAmount === undefined || !intent.cryptoAsset || cryptoToMinor(event.cryptoAmount, intent.cryptoAsset) !== intent.originalAmountMinor)) throw new AppError('Crypto deposit amount requires review', 409);
    const required = intent.requiredConfirmations ?? 1;
    if (event.confirmations !== undefined && event.confirmations < required) {
      // Detected but not yet final — record progress, stay PROCESSING.
      await this.intentRepo.markCryptoProcessing(intent.id, {
        transactionHash: event.transactionHash,
        confirmationCount: event.confirmations,
      });
      return;
    }

    // GHS-equivalent settlement (§9): the campaign is credited the locked GHS
    // amount; the provider + network fee is the processor fee, the platform fee
    // follows the campaign creator's plan (§10). Split/ledger/receipts reuse the
    // shared SettleDonation seam untouched.
    const campaign = await this.campaignRepo.findById(intent.campaignId);
    const platformFeePercent = campaign
      ? await this.planLimits.platformFeePercent(campaign.creatorId)
      : undefined;
    const processorFeeGhs =
      intent.providerFeeMinor !== undefined ? intent.providerFeeMinor / 100 : 0;

    const breakdown = this.feePolicy.computeSettlementFromProvider({
      gross: intent.amount, // GHS-equivalent; crypto donations carry no tip
      tip: 0,
      processorFee: processorFeeGhs,
      currency: intent.currency,
      providerRef: intent.providerRef,
      platformFeePercent,
    });

    await this.intentRepo.recordCryptoProgress(intent.id, {
      transactionHash: event.transactionHash,
      confirmationCount: event.confirmations,
    });
    await this.settleDonationUseCase.execute(intent, breakdown);
  }
}
