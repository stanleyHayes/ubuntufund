import { randomUUID } from 'node:crypto';
import type { PlanLimitsService } from '../services/PlanLimitsService.js';
import type { CreatorProfileRepositoryPort } from '../../domain/ports/outbound/CreatorProfileRepositoryPort.js';
import type { TipRepositoryPort } from '../../domain/ports/outbound/TipRepositoryPort.js';
import type { CreatorBalanceRepositoryPort } from '../../domain/ports/outbound/CreatorBalanceRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import { TipEntity } from '../../domain/entities/Tip.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface CreateTipInput {
  amount: number;
  supporterEmail: string;
  supporterName?: string;
  supporterUserId?: string;
  message?: string;
  isAnonymous?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

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
    private readonly plans: PlanLimitsService
  ) {}

  async execute(handle: string, input: CreateTipInput) {
    const creator = await this.profileRepo.findByHandle(handle);
    if (!creator) throw new AppError('Creator not found', 404);
    await this.plans.assertCreatorDonations(creator.userId);
    if (!creator.tipsEnabled) {
      throw new AppError('This creator is not accepting tips right now.', 409);
    }
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new AppError('Enter a tip amount.', 400);
    }
    if (!input.supporterEmail) {
      throw new AppError('An email is required to pay.', 400);
    }

    const fee = 0; // Plan fee is charged once, on withdrawal.
    const net = round2(input.amount - fee);

    const reference = `tip-${randomUUID()}`;

    const now = new Date();
    const tip = await this.tipRepo.create(
      new TipEntity({
        id: '',
        creatorUserId: creator.userId,
        amount: input.amount,
        currency: creator.currency,
        supporterUserId: input.supporterUserId,
        supporterName: input.supporterName,
        supporterEmail: input.supporterEmail,
        message: input.message,
        isAnonymous: input.isAnonymous ?? false,
        status: 'PENDING',
        settlementApplied: false,
        provider: 'paystack',
        providerRef: reference,
        platformFee: fee,
        netAmount: net,
        createdAt: now,
        updatedAt: now,
      })
    );
    // Make sure a balance row exists so the later credit lands cleanly.
    await this.balanceRepo.ensure(creator.userId, creator.currency);

    const init = await this.gateway.initializeCharge({
      email: input.supporterEmail,
      amount: input.amount,
      referencePrefix: 'tip',
      reference,
      metadata: { type: 'tip', creatorUserId: creator.userId, handle: creator.handle },
      callbackPath: '/tip/callback',
    });


    return {
      checkoutUrl: init.authorizationUrl,
      accessCode: init.accessCode,
      reference: init.reference,
      tipId: tip.id,
    };
  }
}
