import type { PipelineStage } from 'mongoose';
import { CampaignStatus } from '@ubuntu-fund/types';
import type {
  AnalyticsRepositoryPort,
  PlatformOverviewRecord,
} from '../../../../domain/ports/outbound/AnalyticsRepositoryPort.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { CampaignModel } from '../../../database/models/CampaignModel.js';
import { DonationModel } from '../../../database/models/DonationModel.js';
import { ReportModel } from '../../../database/models/ReportModel.js';

interface StatusCountRaw {
  _id: string;
  count: number;
}

interface DonationTotalsRaw {
  _id: null;
  totalRaised: number;
  totalDonations: number;
  distinctDonors: string[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function monthStart(date: Date, monthsAgo: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthsAgo, 1)
  );
}

export class MongoAnalyticsRepository implements AnalyticsRepositoryPort {
  async getOverview(): Promise<PlatformOverviewRecord> {
    const now = new Date();
    const thisMonthStart = monthStart(now, 0);
    const lastMonthStart = monthStart(now, 1);

    const [
      totalUsers,
      campaignStatusCounts,
      donationTotals,
      pendingDisputes,
      thisMonthUsers,
      lastMonthUsers,
    ] = await Promise.all([
      UserModel.countDocuments(),
      CampaignModel.aggregate<StatusCountRaw>([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ] as PipelineStage[]),
      DonationModel.aggregate<DonationTotalsRaw>([
        {
          $group: {
            _id: null,
            totalRaised: { $sum: '$amount' },
            totalDonations: { $sum: 1 },
            distinctDonors: { $addToSet: '$donorId' },
          },
        },
      ] as PipelineStage[]),
      ReportModel.countDocuments({ status: 'pending' }),
      UserModel.countDocuments({ createdAt: { $gte: thisMonthStart } }),
      UserModel.countDocuments({
        createdAt: { $gte: lastMonthStart, $lt: thisMonthStart },
      }),
    ]);

    const campaignsByStatus: Record<string, number> = Object.fromEntries(
      Object.values(CampaignStatus).map((status) => [status, 0])
    );
    for (const entry of campaignStatusCounts) {
      campaignsByStatus[entry._id] = entry.count;
    }
    const activeCampaigns = campaignsByStatus[CampaignStatus.ACTIVE] ?? 0;

    const totals = donationTotals[0];
    const totalRaised = totals?.totalRaised ?? 0;
    const totalDonations = totals?.totalDonations ?? 0;
    const distinctDonorCount = totals?.distinctDonors.length ?? 0;
    const avgDonation =
      totalDonations > 0 ? round2(totalRaised / totalDonations) : 0;
    const conversionRate =
      totalUsers > 0 ? round2((distinctDonorCount / totalUsers) * 100) : 0;
    const monthlyGrowth =
      lastMonthUsers > 0
        ? round2(((thisMonthUsers - lastMonthUsers) / lastMonthUsers) * 100)
        : thisMonthUsers > 0
          ? 100
          : 0;

    return {
      totalUsers,
      activeCampaigns,
      campaignsByStatus,
      totalDonations,
      totalRaised,
      avgDonation,
      conversionRate,
      monthlyGrowth,
      pendingDisputes,
    };
  }
}
