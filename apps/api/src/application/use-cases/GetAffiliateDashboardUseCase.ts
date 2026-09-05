import type { AffiliateDashboard, AffiliateStats } from '@ubuntu-fund/types';
import type { AffiliateRepositoryPort } from '../../domain/ports/outbound/AffiliateRepositoryPort.js';
import type { AffiliateBalanceRepositoryPort } from '../../domain/ports/outbound/AffiliateBalanceRepositoryPort.js';
import type { AffiliateCommissionRepositoryPort } from '../../domain/ports/outbound/AffiliateCommissionRepositoryPort.js';
import type { AffiliateReferralRepositoryPort } from '../../domain/ports/outbound/AffiliateReferralRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

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
    private readonly publicWebUrl: string
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

    // Mature this affiliate's held commissions whose hold window has elapsed:
    // clear pending → available (guarded) and transition the commission. Tying
    // the transition to the guarded balance move keeps a replay from crediting
    // twice.
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
      availableBalance: fresh.availableBalance,
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
