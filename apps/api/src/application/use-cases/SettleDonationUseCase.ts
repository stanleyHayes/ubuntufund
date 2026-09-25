import type { WalletRepositoryPort } from '../../domain/ports/outbound/WalletRepositoryPort.js';
import type { WalletTransactionRepositoryPort } from '../../domain/ports/outbound/WalletTransactionRepositoryPort.js';
import type { UnitOfWorkPort } from '../../domain/ports/outbound/UnitOfWorkPort.js';
import type { OutboxRecord } from '@ubuntu-fund/types';
import {
  PaymentMethod,
  TransactionType,
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
import type { CouponRepositoryPort } from '../../domain/ports/outbound/CouponRepositoryPort.js';
import type { CouponRedemptionRepositoryPort } from '../../domain/ports/outbound/CouponRedemptionRepositoryPort.js';
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
 * calls for verified funds. The wallet rail debits within this transaction; the Paystack rail (Phase 4) calls it from its
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
 * The success gate, donation, journal, projections and outbox commit together.
 * A failed write rolls back the gate; a retry applies the complete settlement.
 * External outbox delivery runs only after commit.
 */
export class SettleDonationUseCase {
  constructor(
    private readonly donationIntentRepo: DonationIntentRepositoryPort,
    private readonly donationRepo: DonationRepositoryPort,
    private readonly postDonationJournalUseCase: PostDonationJournalUseCase,
    private readonly projector: CampaignLedgerProjector,
    private readonly outboxRepo: OutboxRepositoryPort,
    private readonly outboxDispatcher: OutboxDispatcher,
    private readonly unitOfWork: UnitOfWorkPort,
    /**
     * Optional: redeems a donation's fee-waiver coupon. Wired here rather than
     * in each rail because all five — wallet, Paystack, Flutterwave, crypto and
     * reconciliation — converge on this use-case, so the redemption happens
     * exactly once however the donation settled.
     */
    private readonly couponRepo?: CouponRepositoryPort,
    private readonly couponRedemptionRepo?: CouponRedemptionRepositoryPort,
    private readonly walletRepo?: WalletRepositoryPort,
    private readonly walletTxRepo?: WalletTransactionRepositoryPort,
  ) {}

  async execute(
    intent: DonationIntentEntity,
    breakdown: DonationSettlementBreakdown,
    verifiedChannel?: unknown
  ): Promise<DonationIntentEntity> {
    const result = await this.unitOfWork.run(() => this.settle(intent, breakdown, verifiedChannel));
    if (result.error) throw result.error;
    // External delivery must only observe committed accounting. A delivery
    // outage must not make the wallet caller refund an already-settled donation.
    if (result.outbox) {
      try { await this.outboxDispatcher.dispatch(result.outbox); }
      catch (error) { logger.error({ err: error, outboxId: result.outbox.id }, 'committed donation delivery pending outbox retry'); }
    }
    return result.intent;
  }

  private async settle(
    intent: DonationIntentEntity,
    breakdown: DonationSettlementBreakdown,
    verifiedChannel?: unknown
  ): Promise<{ intent: DonationIntentEntity; outbox?: OutboxRecord; error?: AppError }> {
    // ── 1. Exactly-once settlement gate ──────────────────────────────────
    const settled = await this.donationIntentRepo.transitionToSucceeded(
      intent.id,
      breakdown.providerRef
    );
    if (!settled) {
      const current = await this.donationIntentRepo.findById(intent.id);
      if (current?.status === 'SUCCEEDED') {
        // Already settled by a prior call — idempotent no-op.
        return { intent: current };
      }
      throw new AppError(
        `Cannot settle donation intent in state ${current?.status ?? 'unknown'}`,
        409
      );
    }

    // The intent gate serializes wallet debits with every replay. These writes
    // enlist in this same transaction; never compensate an uncertain commit.
    if (settled.provider === 'wallet') {
      if (!this.walletRepo || !this.walletTxRepo) throw new AppError('Wallet settlement is unavailable', 503);
      const userId = settled.donorUserId;
      if (!userId || breakdown.currency !== settled.currency ||
          toMinorUnits(breakdown.amount, breakdown.currency) !== toMinorUnits(settled.amount, settled.currency) ||
          toMinorUnits(breakdown.gross, breakdown.currency) !== toMinorUnits(settled.amount + settled.tip, settled.currency)) {
        throw new AppError('Wallet settlement does not match the donation intent', 409);
      }
      const wallets = await this.walletRepo.findByUserId(userId);
      const wallet = wallets.find(w => w.balance.currency === settled.currency);
      const debited = wallet && await this.walletRepo.withdrawIfSufficient(wallet.id, userId, new Money(breakdown.gross, settled.currency));
      if (!debited) {
        // A known refusal commits a terminal failure and frees the coupon seat.
        // Infrastructure failures instead throw and roll back for a safe retry.
        const failed = await this.donationIntentRepo.updateStatus(settled.id, 'FAILED');
        if (!failed) throw new AppError('Donation intent disappeared during wallet refusal', 409);
        if (settled.couponId && this.couponRedemptionRepo) {
          const seat = await this.couponRedemptionRepo.findByProviderRef(settled.id);
          if (seat) await this.couponRedemptionRepo.markReleased(seat.id);
        }
        return { intent: failed, error: new AppError(wallet ? 'Insufficient wallet balance' : 'No wallet found for this currency', 400) };
      }
      await this.walletTxRepo.record({ walletId: wallet!.id, userId, type: TransactionType.DONATION,
        amount: breakdown.gross, currency: settled.currency, reference: `donation-intent:${settled.id}`,
        metadata: { campaignId: settled.campaignId, tip: settled.tip } });
    }

    // ── 2. Record donation + immutable ledger journal + projections ──────
    const donorId = settled.donorUserId ?? GUEST_DONOR_ID;
    const donation = await this.donationRepo.save(
      new DonationEntity({
        id: '',
        campaignId: settled.campaignId,
        donorId,
        amount: new Money(breakdown.amount, breakdown.currency),
        tip: breakdown.tip,
        paymentMethod: providerToPaymentMethod(settled.provider, verifiedChannel),
        message: settled.message,
        donorName: settled.donorName,
        messageAgreement: settled.toPlain().messageAgreement,
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

    await this.projector.projectDonation(settled.campaignId, breakdown, settled.id, settled.provider === 'wallet');

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

    // Separate from the block above on purpose: a failure to record the money
    // split must not skip the redemption, and vice versa.
    await this.redeemFeeWaiver(settled);

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
    return { intent: settled, outbox: outboxRecord };
  }

  /**
   * Redeem a donation's fee-waiver coupon, exactly once.
   *
   * Reached only through the exactly-once settlement gate above, so a replayed
   * webhook returns before getting here and cannot double-redeem. Never throws:
   * the campaign has already been credited at the waived fee, and failing now
   * would report an error for a donation that plainly succeeded.
   *
   * A coupon found to be over its global cap is logged rather than refused, for
   * the same reason — the money has moved, and the waiver was already applied
   * when the donor was quoted.
   */
  private async redeemFeeWaiver(settled: DonationIntentEntity): Promise<void> {
    if (!settled.couponId || !this.couponRedemptionRepo) return;
    try {
      const bumped = await this.couponRepo?.incrementRedemptionIfUnderLimit(settled.couponId);
      if (this.couponRepo && !bumped) {
        logger.warn(
          { couponId: settled.couponId, donationIntentId: settled.id },
          'donation settled but its fee-waiver coupon was already at its global limit'
        );
      }
      const redemption = await this.couponRedemptionRepo.findByProviderRef(settled.id);
      if (redemption) await this.couponRedemptionRepo.markConsumed(redemption.id);
    } catch (error) {
      logger.error(
        { err: error, donationIntentId: settled.id, couponId: settled.couponId },
        'failed to redeem a donation fee-waiver coupon (non-fatal)'
      );
    }
  }
}
