import type { PipelineStage } from 'mongoose';
import { UserRole } from '@ubuntu-fund/types';
import { DonationModel } from '../../../database/models/DonationModel.js';
import { UserModel } from '../../../database/models/UserModel.js';
import type {
  LeaderboardRepositoryPort,
  LeaderboardQueryParams,
  LeaderboardDonorRecord,
  LeaderboardStatsRecord,
  LeaderboardPeriod,
} from '../../../../domain/ports/outbound/LeaderboardRepositoryPort.js';

interface DonorAggregateRaw {
  _id: string;
  totalDonated: number;
  donationCount: number;
  currency: string;
  campaignIds: string[];
  allAnonymous: boolean;
}

function periodStartDate(period: LeaderboardPeriod): Date | null {
  const now = new Date();
  switch (period) {
    case 'daily':
      return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
      );
    case 'monthly':
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    case 'yearly':
      return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    case 'lifetime':
    default:
      return null;
  }
}

export class MongoLeaderboardRepository implements LeaderboardRepositoryPort {
  async getTopDonors(
    params: LeaderboardQueryParams
  ): Promise<LeaderboardDonorRecord[]> {
    const { category, limit } = params;
    const groups = await this.aggregateDonorTotals(params.period);

    const donorIds = groups.map((g) => g._id);
    const users = await UserModel.find({ _id: { $in: donorIds } });
    const userById = new Map(users.map((u) => [u._id!.toString(), u]));

    const entries: LeaderboardDonorRecord[] = [];
    for (const group of groups) {
      const user = userById.get(group._id);
      if (!user) continue;
      // Leaderboard only ever surfaces donor/organization accounts, never admins.
      if (user.role !== UserRole.USER && user.role !== UserRole.ORGANIZATION) {
        continue;
      }
      if (category !== 'all' && (user.role as string) !== category) continue;

      const userRole: 'user' | 'organization' =
        user.role === UserRole.ORGANIZATION ? 'organization' : 'user';

      entries.push({
        userId: group._id,
        userRole,
        name: group.allAnonymous ? 'Anonymous' : user.name,
        avatarUrl: group.allAnonymous ? undefined : user.avatarUrl,
        totalDonated: group.totalDonated,
        donationCount: group.donationCount,
        currency: group.currency,
        campaignsSupported: group.campaignIds.length,
        isAnonymous: group.allAnonymous,
      });
    }

    entries.sort((a, b) => b.totalDonated - a.totalDonated);
    return entries.slice(0, limit);
  }

  async getStats(
    params: Omit<LeaderboardQueryParams, 'limit'>
  ): Promise<LeaderboardStatsRecord> {
    const { category } = params;
    const groups = await this.aggregateDonorTotals(params.period);

    let relevant = groups;
    if (category !== 'all') {
      const donorIds = groups.map((g) => g._id);
      const users = await UserModel.find({
        _id: { $in: donorIds },
        role: category,
      });
      const allowedIds = new Set(users.map((u) => u._id!.toString()));
      relevant = groups.filter((g) => allowedIds.has(g._id));
    }

    return relevant.reduce(
      (acc, g) => ({
        totalAmount: acc.totalAmount + g.totalDonated,
        totalDonations: acc.totalDonations + g.donationCount,
        totalDonors: acc.totalDonors + 1,
      }),
      { totalAmount: 0, totalDonations: 0, totalDonors: 0 }
    );
  }

  private async aggregateDonorTotals(
    period: LeaderboardPeriod
  ): Promise<DonorAggregateRaw[]> {
    const startDate = periodStartDate(period);

    const pipeline = [
      { $match: startDate ? { createdAt: { $gte: startDate } } : {} },
      {
        $group: {
          _id: '$donorId',
          totalDonated: { $sum: '$amount' },
          donationCount: { $sum: 1 },
          currency: { $first: '$currency' },
          campaignIds: { $addToSet: '$campaignId' },
          allAnonymous: { $min: '$isAnonymous' },
        },
      },
    ];

    const results = await DonationModel.aggregate<DonorAggregateRaw>(
      pipeline as unknown as PipelineStage[]
    );
    return results;
  }
}
