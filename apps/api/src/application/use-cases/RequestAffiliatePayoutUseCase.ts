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
import { AffiliateStatus } from '@ubuntu-fund/types';
import type { UnitOfWorkPort } from '../../domain/ports/outbound/UnitOfWorkPort.js';
import { AffiliateCommissionMaturity } from '../services/AffiliateCommissionMaturity.js';
import type { PayoutEligibilityPort } from '../../domain/ports/outbound/PayoutEligibilityPort.js';
import {
  AFFILIATE_VERIFICATION_REQUIRED,
  VERIFY_EMAIL_BEFORE_AFFILIATE_WITHDRAWAL,
} from '../services/payoutEligibilityMessages.js';

/** The platform's only settlement currency. */
const CURRENCY = 'GHS';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The current (active) user requests a payout of their available affiliate
 * commission. First matures any of their held commissions whose hold window
 * has elapsed (held → available), then reserves the whole withdrawable
 * balance out of `availableBalance` (available → in-transit), records a
 * PENDING payout awaiting ADMIN approval and links the commissions it pays.
 * Only matured (available) funds are withdrawable — still-held (in-hold-window)
 * commissions are not, and any outstanding clawback is withheld.
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
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly unitOfWork?: UnitOfWorkPort,
    /**
     * Money-out gate shared with campaign payouts and creator withdrawals:
     * commissions go to an external bank or MoMo account, so the affiliate
     * needs a verified email and current identity verification. Approval
     * re-checks it inside its transaction.
     */
    private readonly eligibility?: Pick<PayoutEligibilityPort, 'assertOwnerVerified'>
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
    // Approval refuses a suspended affiliate; reserving funds for a request
    // that can never be approved (or released) would strand them.
    if (affiliate.status !== AffiliateStatus.ACTIVE) {
      throw new AppError('Your affiliate account is suspended, so payouts are unavailable.', 403);
    }
    if (!affiliate.recipientCode) {
      throw new AppError(
        'Add a payout recipient before requesting a payout',
        400
      );
    }
    // Checked before anything is matured, reserved or linked (fail closed).
    if (!this.eligibility) throw new AppError('Affiliate payouts are not available right now.', 503);
    await this.eligibility.assertOwnerVerified(
      userId,
      AFFILIATE_VERIFICATION_REQUIRED,
      VERIFY_EMAIL_BEFORE_AFFILIATE_WITHDRAWAL
    );

    const amount = round2(Number(input.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('Payout amount must be greater than zero', 422);
    }

    const balance = await this.affiliateBalanceRepo.ensure(
      affiliate.id,
      CURRENCY
    );

    // Mature this affiliate's due commissions first so their funds count.
    await new AffiliateCommissionMaturity(
      this.affiliateCommissionRepo,
      this.affiliateBalanceRepo,
      this.unitOfWork
    ).mature(new Date(), affiliate.id);

    const fresh =
      (await this.affiliateBalanceRepo.findByAffiliateId(affiliate.id)) ??
      balance;
    const currency = fresh.currency ?? CURRENCY;
    // Clawed-back commission (a refund after payout) is withheld until covered.
    const available = round2(
      Math.max(0, fresh.availableBalance - (fresh.clawbackOutstanding ?? 0))
    );

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
    // A payout takes the whole withdrawable balance so the commissions it pays
    // can be linked to it exactly (and marked paid when the transfer lands).
    if (amount !== available) {
      throw new AppError(
        `Affiliate payouts withdraw your full available balance of ${currency} ${available.toLocaleString('en-US')}. Refresh and try again.`,
        422
      );
    }

    // Reserve the funds (available → in-transit), record the payout and link
    // the commissions it pays, together. A short balance (lost a race) leaves
    // nothing recorded.
    const work = async () => {
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

      const created = await this.affiliatePayoutRepo.create(
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
      await this.affiliateCommissionRepo.linkAvailableToPayout?.(
        affiliate.id,
        created.id,
        amount
      );
      return created;
    };
    const saved = this.unitOfWork ? await this.unitOfWork.run(work) : await work();

    return toAffiliatePayoutDto(saved);
  }
}
