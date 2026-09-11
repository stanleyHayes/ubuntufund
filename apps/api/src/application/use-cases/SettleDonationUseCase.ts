import {
  PaymentMethod,
  type DonationSettlementBreakdown,
  type DonationSucceededPayload,
} from '@ubuntu-fund/types';
import { DonationEntity, GUEST_DONOR_ID } from '../../domain/entities/Donation.js';
import type { DonationIntentEntity } from '../../domain/entities/DonationIntent.js';
import { Money, toMinorUnits, fromMinorUnits } from '../../domain/value-objects/Money.js';
import type { DonationIntentRepositoryPort } from '../../domain/ports/outbound/DonationIntentRepositoryPort.js';
import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type { OutboxRepositoryPort } from '../../domain/ports/outbound/OutboxRepositoryPort.js';
import type { PostDonationJournalUseCase } from './PostDonationJournalUseCase.js';
import type { CampaignLedgerProjector } from '../services/CampaignLedgerProjector.js';
import type { OutboxDispatcher } from '../services/OutboxDispatcher.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { logger } from '../../infrastructure/logging/logger.js';

/** Round an observed FX rate to 6 dp for storage. */
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** Maps a payment provider onto the legacy donation's payment method. */
export function providerToPaymentMethod(provider: string, channel?: unknown): PaymentMethod {
  if (provider === 'wallet') return PaymentMethod.WALLET;
  if (channel === 'mobile_money') return PaymentMethod.MOBILE_MONEY;
  if (channel === 'bank_transfer' || channel === 'bank') return PaymentMethod.BANK_TRANSFER;
  if (channel === 'crypto' || provider === 'bitnob') return PaymentMethod.CRYPTO;
  // Apple Pay / Google Pay are card-funded wallets: Paystack reports them as
  // their own channel but settles them on the card rails, and CARD is the
  // enum's meaning here. Listed explicitly so it reads as a decision rather
  // than an accident of the fallthrough below.
  if (channel === 'apple_pay' || channel === 'google_pay') return PaymentMethod.CARD;
  return PaymentMethod.CARD;
}

/**
 * Settles a donation intent — the single reusable seam every payment rail
 * calls once its money has actually moved. The wallet rail calls it inline
 * after debiting; the Paystack rail (Phase 4) calls it from its
 * webhook/verification with the provider's real fee breakdown.
 *
 * settleDonation(intent, providerBreakdown):
 *   1. Atomically transition CREATED|PENDING → SUCCEEDED (the exactly-once
 *      gate). An already-SUCCEEDED intent is a no-op (returns as-is); a
 *      terminal FAILED/EXPIRED intent is a conflict.
 *   2. Record the donation, post the immutable ledger journal, and project the
 *      campaign raised total + beneficiary balance from it.
 *   3. Enqueue a `donation.succeeded` outbox row and dispatch it in-process
 *      (realtime + receipts), so those side-effects survive a restart.
 *
 * Every step after the gate is idempotent (ledger dedupes on the intent;
 * outbox handlers are re-runnable), so a retried settlement is safe.
 */
export class SettleDonationUseCase {
  constructor(
    private readonly donationIntentRepo: DonationIntentRepositoryPort,
    private readonly donationRepo: DonationRepositoryPort,
    private readonly postDonationJournalUseCase: PostDonationJournalUseCase,
    private readonly projector: CampaignLedgerProjector,
    private readonly outboxRepo: OutboxRepositoryPort,
    private readonly outboxDispatcher: OutboxDispatcher
  ) {}

  async execute(
    intent: DonationIntentEntity,
    breakdown: DonationSettlementBreakdown,
    verifiedChannel?: unknown
  ): Promise<DonationIntentEntity> {
    // ── 1. Exactly-once settlement gate ──────────────────────────────────
    const settled = await this.donationIntentRepo.transitionToSucceeded(
      intent.id,
      breakdown.providerRef
    );
    if (!settled) {
      const current = await this.donationIntentRepo.findById(intent.id);
      if (current?.status === 'SUCCEEDED') {
        // Already settled by a prior call — idempotent no-op.
        return current;
      }
      throw new AppError(
        `Cannot settle donation intent in state ${current?.status ?? 'unknown'}`,
        409
      );
    }

    // ── 2. Record donation + immutable ledger journal + projections ──────
    const donorId = settled.donorUserId ?? GUEST_DONOR_ID;
    const donation = await this.donationRepo.save(
      new DonationEntity({
        id: '',
        campaignId: settled.campaignId,
        donorId,
        amount: new Money(breakdown.amount, breakdown.currency),
        paymentMethod: providerToPaymentMethod(settled.provider, verifiedChannel),
        message: settled.message,
        isAnonymous: settled.isAnonymous,
        createdAt: new Date(),
      })
    );

    await this.postDonationJournalUseCase.execute(breakdown, {
      campaignId: settled.campaignId,
      donationId: donation.id,
      donationIntentId: settled.id,
      memo: `donation ${donation.id} via ${settled.provider}`,
    });

    await this.projector.projectDonation(settled.campaignId, breakdown, settled.id);

    // Record the verified settlement money split in integer minor units (spec
    // §8) — additive and best-effort, so it never fails the settlement. The
    // ledger/projection above remain the crediting source of truth.
    try {
      const settlementCurrency = breakdown.currency;
      const originalCurrency = settled.originalCurrency ?? settlementCurrency;
      const originalGross =
        settled.originalAmountMinor !== undefined
          ? fromMinorUnits(settled.originalAmountMinor, originalCurrency)
          : undefined;
      const hasFx =
        originalCurrency !== settlementCurrency && originalGross !== undefined && originalGross > 0;
      await this.donationIntentRepo.recordSettlementFinancials(settled.id, {
        settlementAmountMinor: toMinorUnits(breakdown.gross, settlementCurrency),
        settlementCurrency,
        providerFeeMinor: toMinorUnits(breakdown.processorFee, settlementCurrency),
        platformFeeMinor: toMinorUnits(breakdown.platformFee, settlementCurrency),
        netCampaignAmountMinor: toMinorUnits(breakdown.beneficiaryNet, settlementCurrency),
        fxRate: hasFx ? round6(breakdown.gross / originalGross!) : 1,
        fxSource: hasFx ? 'provider' : undefined,
      });
    } catch (error) {
      logger.error(
        { err: error, donationIntentId: settled.id },
        'failed to record settlement financials (non-fatal)'
      );
    }

    // ── 3. Durable side-effects (realtime + receipts) via the outbox ─────
    const payload: DonationSucceededPayload = {
      donationId: donation.id,
      donationIntentId: settled.id,
      campaignId: settled.campaignId,
      liveSessionId: settled.liveSessionId,
      donorId,
      donorName: settled.isAnonymous ? undefined : settled.donorName,
      amount: breakdown.amount,
      currency: breakdown.currency,
      message: settled.message,
      isAnonymous: settled.isAnonymous,
      createdAt: donation.createdAt.toISOString(),
    };
    const outboxRecord = await this.outboxRepo.enqueue({
      type: 'donation.succeeded',
      payload,
    });
    // Dispatch now; anything left pending after a crash is re-swept on boot.
    await this.outboxDispatcher.dispatch(outboxRecord);

    return settled;
  }
}
