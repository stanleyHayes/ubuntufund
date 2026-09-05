import {
  TransactionType,
  type CreateDonationIntentInput,
} from '@ubuntu-fund/types';
import { DonationIntentEntity } from '../../domain/entities/DonationIntent.js';
import { Money } from '../../domain/value-objects/Money.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { LiveSessionRepositoryPort } from '../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import type { WalletRepositoryPort } from '../../domain/ports/outbound/WalletRepositoryPort.js';
import type { WalletTransactionRepositoryPort } from '../../domain/ports/outbound/WalletTransactionRepositoryPort.js';
import type { DonationIntentRepositoryPort } from '../../domain/ports/outbound/DonationIntentRepositoryPort.js';
import type { PaymentAttemptRepositoryPort } from '../../domain/ports/outbound/PaymentAttemptRepositoryPort.js';
import type {
  PaymentGatewayInitResult,
  PaymentGatewayPort,
} from '../../domain/ports/outbound/PaymentGatewayPort.js';
import type { FeePolicy } from '../services/FeePolicy.js';
import type { PlanLimitsService } from '../services/PlanLimitsService.js';
import type { SettleDonationUseCase } from './SettleDonationUseCase.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { logger } from '../../infrastructure/logging/logger.js';

export interface CreateDonationIntentContext {
  /** Authenticated donor id, or null for a guest checkout. */
  donorUserId: string | null;
  /** Resolved idempotency key (Idempotency-Key header, body, or generated). */
  idempotencyKey: string;
}

/**
 * The intent, plus the hosted-checkout handoff when one was opened. The wallet
 * rail returns just the (settled) intent; the Paystack rail also returns the
 * authorization URL / access code / reference the donor is sent to.
 */
export interface CreateDonationIntentResult {
  intent: DonationIntentEntity;
  hostedInit?: PaymentGatewayInitResult;
}

/** Duplicate-key detection for the idempotencyKey unique index. */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

/**
 * Creates a donation intent (PUBLIC — guests allowed) and, for the wallet rail
 * with an authenticated donor, settles it synchronously.
 *
 * - `provider: 'wallet'` (authed): atomically debit the donor's wallet for
 *   amount + tip, then hand off to {@link SettleDonationUseCase} — which marks
 *   the intent SUCCEEDED, posts the ledger journal, projects totals, and
 *   dispatches realtime/receipt side-effects through the outbox.
 * - `provider: 'paystack'` (guest or authed): open a Paystack hosted checkout
 *   (intent CREATED → PENDING) and return the authorization URL / reference;
 *   settlement lands later via the signed webhook. Disabled with a 501 when no
 *   Paystack secret is configured.
 *
 * Idempotent: repeated submits with the same idempotency key resolve to the
 * same intent — no double charge.
 */
export class CreateDonationIntentUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly liveSessionRepo: LiveSessionRepositoryPort,
    private readonly walletRepo: WalletRepositoryPort,
    private readonly donationIntentRepo: DonationIntentRepositoryPort,
    private readonly feePolicy: FeePolicy,
    private readonly settleDonationUseCase: SettleDonationUseCase,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly planLimits: PlanLimitsService,
    private readonly walletTxRepo?: WalletTransactionRepositoryPort,
    private readonly paymentAttemptRepo?: PaymentAttemptRepositoryPort
  ) {}

  async execute(
    input: CreateDonationIntentInput,
    ctx: CreateDonationIntentContext
  ): Promise<CreateDonationIntentResult> {
    // Idempotency: an existing intent for this key is returned unchanged, so a
    // retry never creates a second intent or charges twice.
    const existing = await this.donationIntentRepo.findByIdempotencyKey(
      ctx.idempotencyKey
    );
    if (existing) return { intent: existing };

    if (input.amount <= 0) {
      throw new AppError('Donation amount must be greater than zero', 400);
    }
    const tip = input.tip ?? 0;
    if (tip < 0) {
      throw new AppError('Tip cannot be negative', 400);
    }

    if (input.provider === 'wallet' && ctx.donorUserId === null) {
      throw new AppError('Wallet donations require an authenticated account', 400);
    }

    // Paystack pre-flight before persisting anything, so a disabled gateway or
    // a guest with no email never leaves an orphan CREATED intent behind.
    if (input.provider === 'paystack') {
      if (!this.paymentGateway.isConfigured()) {
        throw new AppError('Payments are not configured', 501);
      }
      if (!input.donorEmail) {
        throw new AppError('An email is required to pay with Paystack', 400);
      }
    }

    const campaign = await this.campaignRepo.findById(input.campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }
    if (!campaign.canReceiveDonation()) {
      throw new AppError('Campaign is not accepting donations', 400);
    }
    const currency = campaign.goalAmount.currency;

    // Validate live-session attribution belongs to this campaign, if supplied.
    if (input.liveSessionId) {
      const session = await this.liveSessionRepo.findById(input.liveSessionId);
      if (!session || session.campaignId !== input.campaignId) {
        throw new AppError('Live session does not belong to this campaign', 400);
      }
    }

    const intent = await this.createIntent(input, ctx, currency, tip);

    if (input.provider === 'paystack') {
      // Hosted rail: open the Paystack checkout and move CREATED → PENDING.
      return this.initializePaystackIntent(intent);
    }

    // ── Wallet rail (authed donor): debit, then settle synchronously ──────
    // The platform fee follows the campaign creator's subscription plan, not a
    // flat rate. Resolve it here (creator known) and pass it into the split.
    const platformFeePercent = await this.planLimits.platformFeePercent(
      campaign.creatorId
    );
    const settled = await this.settleWalletIntent(
      intent,
      ctx.donorUserId!,
      currency,
      tip,
      platformFeePercent
    );
    return { intent: settled };
  }

  /**
   * Open a Paystack hosted checkout for a freshly-created CREATED intent: call
   * the gateway, move the intent to PENDING with the provider reference, and
   * record the initiation attempt. The signed `charge.success` webhook settles
   * it later.
   */
  private async initializePaystackIntent(
    intent: DonationIntentEntity
  ): Promise<CreateDonationIntentResult> {
    const init = await this.paymentGateway.initializeTransaction(intent);

    // Store the reference (providerRef) and advance to PENDING so the webhook
    // can correlate the settlement back to this intent.
    const pending = await this.donationIntentRepo.updateStatus(
      intent.id,
      'PENDING',
      init.reference
    );

    // Audit trail for the checkout (best-effort; never fails the request).
    if (this.paymentAttemptRepo) {
      try {
        await this.paymentAttemptRepo.record({
          intentId: intent.id,
          provider: 'paystack',
          providerRef: init.reference,
          status: 'initiated',
        });
      } catch (error) {
        logger.error(
          { err: error, intentId: intent.id },
          'failed to record paystack initiation attempt'
        );
      }
    }

    return { intent: pending ?? intent, hostedInit: init };
  }

  private async createIntent(
    input: CreateDonationIntentInput,
    ctx: CreateDonationIntentContext,
    currency: string,
    tip: number
  ): Promise<DonationIntentEntity> {
    const now = new Date();
    const draft = new DonationIntentEntity({
      id: '',
      campaignId: input.campaignId,
      liveSessionId: input.liveSessionId,
      amount: input.amount,
      currency,
      donorUserId: ctx.donorUserId,
      donorEmail: input.donorEmail,
      donorName: input.donorName,
      message: input.message,
      isAnonymous: input.isAnonymous ?? false,
      tip,
      status: 'CREATED',
      provider: input.provider,
      idempotencyKey: ctx.idempotencyKey,
      attribution: input.attribution,
      createdAt: now,
      updatedAt: now,
    });

    try {
      return await this.donationIntentRepo.create(draft);
    } catch (error) {
      // Lost a race on the same idempotency key — resolve to the winner.
      if (isDuplicateKeyError(error)) {
        const winner = await this.donationIntentRepo.findByIdempotencyKey(
          ctx.idempotencyKey
        );
        if (winner) return winner;
      }
      throw error;
    }
  }

  private async settleWalletIntent(
    intent: DonationIntentEntity,
    donorUserId: string,
    currency: string,
    tip: number,
    platformFeePercent: number
  ): Promise<DonationIntentEntity> {
    // A concurrent retry may have already settled this intent.
    if (intent.status === 'SUCCEEDED') return intent;

    const breakdown = this.feePolicy.computeBreakdown(
      intent.amount,
      tip,
      currency,
      'wallet',
      platformFeePercent
    );

    const wallets = await this.walletRepo.findByUserId(donorUserId);
    const wallet = wallets.find((w) => w.balance.currency === currency);
    if (!wallet) {
      await this.donationIntentRepo.updateStatus(intent.id, 'FAILED');
      throw new AppError('No wallet found for this currency', 400);
    }

    // Charge amount + tip atomically; fails rather than overdrawing.
    const grossCharge = new Money(breakdown.gross, currency);
    const debited = await this.walletRepo.withdrawIfSufficient(
      wallet.id,
      donorUserId,
      grossCharge
    );
    if (!debited) {
      await this.donationIntentRepo.updateStatus(intent.id, 'FAILED');
      throw new AppError('Insufficient wallet balance', 400);
    }

    // Record the wallet attempt (best-effort; never fails the donation).
    if (this.paymentAttemptRepo) {
      try {
        await this.paymentAttemptRepo.record({
          intentId: intent.id,
          provider: 'wallet',
          status: 'succeeded',
        });
      } catch (error) {
        logger.error({ err: error, intentId: intent.id }, 'failed to record wallet payment attempt');
      }
    }

    let settled: DonationIntentEntity;
    try {
      settled = await this.settleDonationUseCase.execute(intent, breakdown);
    } catch (error) {
      // Settlement failed after the debit landed — refund so no money is lost.
      await this.walletRepo.depositAtomic(wallet.id, donorUserId, grossCharge);
      await this.donationIntentRepo.updateStatus(intent.id, 'FAILED');
      throw error;
    }

    // Wallet ledger row for the donor's transaction history (best-effort).
    if (this.walletTxRepo) {
      try {
        await this.walletTxRepo.record({
          walletId: wallet.id,
          userId: donorUserId,
          type: TransactionType.DONATION,
          amount: breakdown.gross,
          currency,
          reference: `donation-intent:${intent.id}`,
          metadata: { campaignId: intent.campaignId, tip },
        });
      } catch (error) {
        logger.error({ err: error, intentId: intent.id }, 'failed to record donation transaction');
      }
    }

    return settled;
  }
}
