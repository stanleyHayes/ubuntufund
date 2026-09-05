import type {
  AffiliatePayout,
  RequestAffiliatePayoutInput,
} from '@ubuntu-fund/types';
import { AffiliatePayoutEntity } from '../../domain/entities/AffiliatePayout.js';
import type { AffiliateRepositoryPort } from '../../domain/ports/outbound/AffiliateRepositoryPort.js';
import type { AffiliatePayoutRepositoryPort } from '../../domain/ports/outbound/AffiliatePayoutRepositoryPort.js';
import type { AffiliateBalanceRepositoryPort } from '../../domain/ports/outbound/AffiliateBalanceRepositoryPort.js';
import type { AffiliateCommissionRepositoryPort } from '../../domain/ports/outbound/AffiliateCommissionRepositoryPort.js';
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { toAffiliatePayoutDto } from './mappers/affiliateDto.js';

/** The platform's only settlement currency. */
const CURRENCY = 'GHS';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The current user requests a payout of their available affiliate commission.
 * First matures any of their held commissions whose hold window has elapsed
 * (held → available), then reserves the requested amount out of
 * `availableBalance` (available → in-transit) and records a PENDING payout
 * awaiting ADMIN approval. Only matured (available) funds are withdrawable —
 * still-held (in-hold-window) commissions are not.
 *
 * The reservation is guarded, so a request over the available balance is
 * rejected. No provider transfer is initiated here; that happens on approval.
 */
export class RequestAffiliatePayoutUseCase {
  constructor(
    private readonly affiliateRepo: AffiliateRepositoryPort,
    private readonly affiliatePayoutRepo: AffiliatePayoutRepositoryPort,
    private readonly affiliateBalanceRepo: AffiliateBalanceRepositoryPort,
    private readonly affiliateCommissionRepo: AffiliateCommissionRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort
  ) {}

  async execute(
    userId: string,
    input: RequestAffiliatePayoutInput
  ): Promise<AffiliatePayout> {
    if (!this.paymentGateway.isConfigured()) {
      throw new AppError('Payouts are not configured', 501);
    }

    const affiliate = await this.affiliateRepo.findByUserId(userId);
    if (!affiliate) {
      throw new AppError('Not enrolled in the affiliate program', 404);
    }
    if (!affiliate.recipientCode) {
      throw new AppError(
        'Add a payout recipient before requesting a payout',
        400
      );
    }

    const amount = round2(Number(input.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('Payout amount must be greater than zero', 422);
    }

    const balance = await this.affiliateBalanceRepo.ensure(
      affiliate.id,
      CURRENCY
    );

    // Mature this affiliate's held commissions whose hold window has elapsed so
    // their funds become withdrawable before we test the available balance.
    const now = new Date();
    const matured = await this.affiliateCommissionRepo.findMaturedHeld(now);
    for (const commission of matured) {
      if (commission.affiliateId !== affiliate.id) continue;
      const cleared = await this.affiliateBalanceRepo.clearPendingToAvailable(
        balance.id,
        commission.amount
      );
      if (!cleared) continue;
      commission.markAvailable();
      await this.affiliateCommissionRepo.update(commission);
    }

    const fresh =
      (await this.affiliateBalanceRepo.findByAffiliateId(affiliate.id)) ??
      balance;
    const available = fresh.availableBalance;
    const currency = fresh.currency ?? CURRENCY;

    if (amount > available) {
      throw new AppError(
        `Cannot request a payout of ${currency} ${amount.toLocaleString(
          'en-US'
        )}; only ${currency} ${available.toLocaleString(
          'en-US'
        )} is available for payout.`,
        422
      );
    }

    // Reserve the funds atomically (available → in-transit). A short balance
    // (lost a race) leaves nothing recorded.
    const reserved = await this.affiliateBalanceRepo.reserveForPayout(
      fresh.id,
      amount
    );
    if (!reserved) {
      throw new AppError(
        'Insufficient available balance to fund this payout',
        422
      );
    }

    const saved = await this.affiliatePayoutRepo.create(
      new AffiliatePayoutEntity({
        id: '', // assigned by the repository
        affiliateId: affiliate.id,
        amount,
        currency,
        status: 'PENDING',
        provider: 'paystack',
        requestedBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );

    return toAffiliatePayoutDto(saved);
  }
}
