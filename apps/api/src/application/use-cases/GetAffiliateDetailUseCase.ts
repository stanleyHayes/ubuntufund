import type {
  Affiliate,
  AffiliateBalance,
  AffiliateCommission,
  AffiliatePayout,
  AffiliateReferral,
  AffiliateStats,
} from '@ubuntu-fund/types';
import type { AffiliateRepositoryPort } from '../../domain/ports/outbound/AffiliateRepositoryPort.js';
import type { AffiliateBalanceRepositoryPort } from '../../domain/ports/outbound/AffiliateBalanceRepositoryPort.js';
import type { AffiliateCommissionRepositoryPort } from '../../domain/ports/outbound/AffiliateCommissionRepositoryPort.js';
import type { AffiliateReferralRepositoryPort } from '../../domain/ports/outbound/AffiliateReferralRepositoryPort.js';
import type { AffiliatePayoutRepositoryPort } from '../../domain/ports/outbound/AffiliatePayoutRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import {
  toAffiliateCommissionDto,
  toAffiliatePayoutDto,
} from './mappers/affiliateDto.js';

/** The platform's only settlement currency. */
const CURRENCY = 'GHS';

/** The full admin view of a single affiliate: profile, balance, and ledgers. */
export interface AffiliateDetailView {
  affiliate: Affiliate;
  balance: AffiliateBalance;
  stats: AffiliateStats;
  referrals: AffiliateReferral[];
  commissions: AffiliateCommission[];
  payouts: AffiliatePayout[];
}

/** Assemble the admin console's detail view for one affiliate. */
export class GetAffiliateDetailUseCase {
  constructor(
    private readonly affiliateRepo: AffiliateRepositoryPort,
    private readonly affiliateBalanceRepo: AffiliateBalanceRepositoryPort,
    private readonly affiliateReferralRepo: AffiliateReferralRepositoryPort,
    private readonly affiliateCommissionRepo: AffiliateCommissionRepositoryPort,
    private readonly affiliatePayoutRepo: AffiliatePayoutRepositoryPort
  ) {}

  async execute(affiliateId: string): Promise<AffiliateDetailView> {
    const affiliate = await this.affiliateRepo.findById(affiliateId);
    if (!affiliate) {
      throw new AppError('Affiliate not found', 404);
    }

    const [balanceRow, referrals, commissions, payouts] = await Promise.all([
      this.affiliateBalanceRepo.findByAffiliateId(affiliate.id),
      this.affiliateReferralRepo.findByReferrerId(affiliate.id),
      this.affiliateCommissionRepo.findByAffiliateId(affiliate.id),
      this.affiliatePayoutRepo.findByAffiliateId(affiliate.id),
    ]);

    const balance: AffiliateBalance = balanceRow ?? {
      id: '',
      affiliateId: affiliate.id,
      currency: CURRENCY,
      totalEarned: 0,
      pendingBalance: 0,
      availableBalance: 0,
      paidOutBalance: 0,
      updatedAt: new Date(),
    };

    const convertedReferrals = referrals.filter(
      (r) => r.status === 'converted'
    ).length;

    const stats: AffiliateStats = {
      totalReferrals: referrals.length,
      convertedReferrals,
      pendingReferrals: referrals.length - convertedReferrals,
      totalEarned: balance.totalEarned,
      availableBalance: balance.availableBalance,
      pendingBalance: balance.pendingBalance,
      paidOutBalance: balance.paidOutBalance,
    };

    return {
      affiliate,
      balance,
      stats,
      referrals,
      commissions: commissions.map(toAffiliateCommissionDto),
      payouts: payouts.map(toAffiliatePayoutDto),
    };
  }
}
