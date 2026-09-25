import type { AffiliateDashboard, AffiliateStats } from '@ubuntu-fund/types';
import type { AffiliateRepositoryPort } from '../../domain/ports/outbound/AffiliateRepositoryPort.js';
import type { AffiliateBalanceRepositoryPort } from '../../domain/ports/outbound/AffiliateBalanceRepositoryPort.js';
import type { AffiliateCommissionRepositoryPort } from '../../domain/ports/outbound/AffiliateCommissionRepositoryPort.js';
import type { AffiliateReferralRepositoryPort } from '../../domain/ports/outbound/AffiliateReferralRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import type { UnitOfWorkPort } from '../../domain/ports/outbound/UnitOfWorkPort.js';
import { AffiliateCommissionMaturity } from '../services/AffiliateCommissionMaturity.js';

/** The platform's only settlement currency. */
const CURRENCY = 'GHS';

/**
 * Build the current user's affiliate dashboard. First matures this affiliate's
 * held commissions whose hold window has elapsed (held → available), moving the
 * funds from pending → available balance so the returned figures are current,
 * then assembles the affiliate, balance, shareable referral link and referral
 * stats.
 */
export class GetAffiliateDashboardUseCase {
  constructor(
    private readonly affiliateRepo: AffiliateRepositoryPort,
    private readonly affiliateBalanceRepo: AffiliateBalanceRepositoryPort,
    private readonly affiliateCommissionRepo: AffiliateCommissionRepositoryPort,
    private readonly affiliateReferralRepo: AffiliateReferralRepositoryPort,
    private readonly publicWebUrl: string,
    private readonly unitOfWork?: UnitOfWorkPort
  ) {}

  async execute(userId: string): Promise<AffiliateDashboard> {
    const affiliate = await this.affiliateRepo.findByUserId(userId);
    if (!affiliate) {
      throw new AppError('Not enrolled in the affiliate program', 404);
    }

    const balance = await this.affiliateBalanceRepo.ensure(
      affiliate.id,
      CURRENCY
    );

    // Mature this affiliate's due commissions (and only this affiliate's) so
    // the figures are current; each is claimed before its funds move, so a
    // concurrent sweep or request can never credit it twice.
    await new AffiliateCommissionMaturity(
      this.affiliateCommissionRepo,
      this.affiliateBalanceRepo,
      this.unitOfWork
    ).mature(new Date(), affiliate.id);

    const fresh =
      (await this.affiliateBalanceRepo.findByAffiliateId(affiliate.id)) ??
      balance;

    const referrals = await this.affiliateReferralRepo.findByReferrerId(
      affiliate.id
    );
    const convertedReferrals = referrals.filter(
      (r) => r.status === 'converted'
    ).length;

    const stats: AffiliateStats = {
      totalReferrals: referrals.length,
      convertedReferrals,
      pendingReferrals: referrals.length - convertedReferrals,
      totalEarned: fresh.totalEarned,
      // What can be withdrawn: commission clawed back after a refund of an
      // already-paid commission is withheld until covered.
      availableBalance: Math.max(
        0,
        Math.round((fresh.availableBalance - (fresh.clawbackOutstanding ?? 0)) * 100) / 100
      ),
      pendingBalance: fresh.pendingBalance,
      paidOutBalance: fresh.paidOutBalance,
    };

    return {
      affiliate,
      balance: fresh,
      referralLink: `${this.publicWebUrl}?ref=${affiliate.referralCode}`,
      stats,
    };
  }
}
