import type { LegalAcceptanceInput } from '@ubuntu-fund/types';
import { messageAgreement } from '../services/messageAgreement.js';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { PlanLimitsService } from '../services/PlanLimitsService.js';
import type { CreatorProfileRepositoryPort } from '../../domain/ports/outbound/CreatorProfileRepositoryPort.js';
import type { TipRepositoryPort } from '../../domain/ports/outbound/TipRepositoryPort.js';
import type { CreatorBalanceRepositoryPort } from '../../domain/ports/outbound/CreatorBalanceRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import { TipEntity } from '../../domain/entities/Tip.js';
import { roundToCurrency } from '../../domain/value-objects/Money.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** Largest single tip (GHS). A tip jar is not a channel for large transfers. */
export const TIP_MAX_AMOUNT = 10_000;

export interface CreateTipInput {
  idempotencyKey?: string;
  legalAcceptance?: LegalAcceptanceInput;
  amount: number;
  supporterEmail: string;
  supporterName?: string;
  supporterUserId?: string;
  message?: string;
  isAnonymous?: boolean;
}

/**
 * Open a hosted checkout for a one-off tip to a creator. Reuses the shared
 * payment gateway's generic charge (a `tip-` reference the webhook routes back
 * to {@link HandleTipWebhookUseCase}). A PENDING tip is recorded now; the
 * creator's balance is credited only when the charge webhook confirms.
 */
export class CreateTipIntentUseCase {
  constructor(
    private readonly profileRepo: CreatorProfileRepositoryPort,
    private readonly tipRepo: TipRepositoryPort,
    private readonly balanceRepo: CreatorBalanceRepositoryPort,
    private readonly gateway: PaymentGatewayPort,
    /** Live paid-plan entitlement; fees are deducted at withdrawal. */
    private readonly plans: PlanLimitsService,
    /**
     * Server-only key for deriving idempotent `tip-` references. The reference
     * must be unguessable: anyone who can compute it in advance could open a
     * cheaper charge under it at the provider before our checkout does.
     */
    private readonly referenceSecret: string
  ) {
    if (!referenceSecret) throw new Error('CreateTipIntentUseCase requires a reference secret');
  }

  async execute(handle: string, input: CreateTipInput) {
    if (input.idempotencyKey !== undefined && !/^[a-zA-Z0-9_-]{16,128}$/.test(input.idempotencyKey)) throw new AppError('Invalid checkout request key.', 400);
    const agreement = messageAgreement(input.message, input.legalAcceptance)
      ?? messageAgreement(input.isAnonymous ? undefined : input.supporterName, input.legalAcceptance);
    const creator = await this.profileRepo.findByHandle(handle);
    if (!creator) throw new AppError('Creator not found', 404);
    await this.plans.assertCreatorDonations(creator.userId);
    if (!creator.tipsEnabled) {
      throw new AppError('This creator is not accepting tips right now.', 409);
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new AppError('Enter a tip amount.', 400);
    }
    if (input.amount > TIP_MAX_AMOUNT) {
      throw new AppError(`A single tip can be at most GHS ${TIP_MAX_AMOUNT.toLocaleString('en-US')}.`, 422);
    }
    // Tipping your own page only round-trips a card charge into withdrawable
    // creator funds; it is never a supporter payment.
    if (input.supporterUserId && input.supporterUserId === creator.userId) {
      throw new AppError('You cannot tip your own creator page.', 422);
    }
    if (!input.supporterEmail) {
      throw new AppError('An email is required to pay.', 400);
    }

    const fee = 0; // Plan fee is charged once, on withdrawal.
    const net = roundToCurrency(input.amount - fee, creator.currency);

    const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
    // Keyed, not a plain hash: the creator id is public and the request key is
    // chosen by the client, so an unkeyed digest would let anyone predict the
    // reference and claim it at the provider first. The same inputs still map
    // to the same reference server-side, so retries stay idempotent.
    const keyedReference = (value: unknown) => createHmac('sha256', this.referenceSecret)
      .update(`tip-reference:v1:${JSON.stringify(value)}`)
      .digest('hex');
    const reference = input.idempotencyKey
      ? `tip-${keyedReference([creator.userId, input.supporterUserId ?? 'guest', input.idempotencyKey])}`
      : `tip-${randomUUID()}`;
    const requestFingerprint = input.idempotencyKey ? hash([
      input.amount, creator.currency, input.supporterEmail, input.supporterName ?? '',
      input.message ?? '', input.isAnonymous ?? false, input.legalAcceptance ?? null,
    ]) : undefined;
    const replay = (existing: TipEntity) => {
      const saved = existing.toPlain();
      if (saved.requestFingerprint !== requestFingerprint) throw new AppError('This checkout request key was already used for different details.', 409);
      if (saved.status === 'SUCCEEDED' || saved.status === 'FAILED' || !saved.checkout?.checkoutUrl) return { checkoutUrl: `/tip/callback?reference=${encodeURIComponent(saved.providerRef)}`, accessCode: '', reference: saved.providerRef, tipId: saved.id };
      return { ...saved.checkout, reference: saved.providerRef, tipId: saved.id };
    };
    if (input.idempotencyKey) {
      const existing = await this.tipRepo.findByProviderRef(reference);
      if (existing) return replay(existing);
    }

    const now = new Date();
    let tip: TipEntity;
    try {
      tip = await this.tipRepo.create(
        new TipEntity({
          id: '',
          creatorUserId: creator.userId,
          amount: input.amount,
          currency: creator.currency,
          supporterUserId: input.supporterUserId,
          supporterName: input.supporterName,
          supporterEmail: input.supporterEmail,
          message: input.message,
          messageAgreement: agreement,
          isAnonymous: input.isAnonymous ?? false,
          status: 'PENDING',
          settlementApplied: false,
          provider: 'paystack',
          providerRef: reference,
          requestFingerprint,
          platformFee: fee,
          netAmount: net,
          createdAt: now,
          updatedAt: now,
        })
      );
    } catch (error) {
      // The unique provider reference reserves the attempt across workers.
      if (input.idempotencyKey && (error as { code?: number }).code === 11000) {
        const existing = await this.tipRepo.findByProviderRef(reference);
        if (existing) return replay(existing);
      }
      throw error;
    }
    // Make sure a balance row exists so the later credit lands cleanly.
    await this.balanceRepo.ensure(creator.userId, creator.currency);

    const init = await this.gateway.initializeCharge({
      email: input.supporterEmail,
      amount: input.amount,
      // The tip is quoted in the creator's currency; the balance row above is
      // created in it too, so the charge must agree.
      currency: creator.currency,
      referencePrefix: 'tip',
      reference,
      metadata: { type: 'tip', creatorUserId: creator.userId, handle: creator.handle },
      callbackPath: '/tip/callback',
    });

    if (init.reference !== reference) throw new AppError('Payment provider returned an unexpected checkout reference.', 502);
    if (input.idempotencyKey) {
      const saved = await this.tipRepo.saveCheckout(reference, { checkoutUrl: init.authorizationUrl, accessCode: init.accessCode });
      if (!saved) {
        const current = await this.tipRepo.findByProviderRef(reference);
        if (current) return replay(current);
        throw new AppError('Checkout is unavailable. Please contact payment support.', 409);
      }
    }
    return {
      checkoutUrl: init.authorizationUrl,
      accessCode: init.accessCode,
      reference: init.reference,
      tipId: tip.id,
    };
  }
}
