import type { PipelineStage } from 'mongoose';
import { CampaignStatus } from '@ubuntu-fund/types';
import type {
  AnalyticsReportRecord,
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

interface MonthlyDonationRaw { _id: { year: number; month: number }; amount: number }
interface AmountByIdRaw { _id: string; amount: number }
interface CountByIdRaw { _id: string; count: number }

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
      UserModel.countDocuments({ deletedAt: null }),
      CampaignModel.aggregate<StatusCountRaw>([
        { $match: { deletedAt: null } },
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
      UserModel.countDocuments({ deletedAt: null, createdAt: { $gte: thisMonthStart } }),
      UserModel.countDocuments({
        deletedAt: null,
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

  async getReports(): Promise<AnalyticsReportRecord> {
    const now = new Date();
    const trendStart = monthStart(now, 8);
    const thisMonthStart = monthStart(now, 0);
    const lastMonthStart = monthStart(now, 1);

    const [monthlyRows, donationsByCampaign, donationsByDonor, campaignsByCreator, reports, totalCampaigns] = await Promise.all([
      DonationModel.aggregate<MonthlyDonationRaw>([
        { $match: { createdAt: { $gte: trendStart } } },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, amount: { $sum: '$amount' } } },
      ] as PipelineStage[]),
      DonationModel.aggregate<AmountByIdRaw>([{ $group: { _id: '$campaignId', amount: { $sum: '$amount' } } }] as PipelineStage[]),
      DonationModel.aggregate<AmountByIdRaw>([{ $group: { _id: '$donorId', amount: { $sum: '$amount' } } }] as PipelineStage[]),
      CampaignModel.aggregate<CountByIdRaw>([
        { $match: { deletedAt: null } },
        { $group: { _id: '$creatorId', count: { $sum: 1 } } },
      ] as PipelineStage[]),
      ReportModel.find().select('campaignId status createdAt updatedAt').lean(),
      CampaignModel.countDocuments({ deletedAt: null }),
    ]);

    const monthAmounts = new Map(monthlyRows.map((row) => [`${row._id.year}-${row._id.month}`, row.amount]));
    const donationTrend = Array.from({ length: 9 }, (_, index) => {
      const date = monthStart(now, 8 - index);
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        amount: monthAmounts.get(`${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`) ?? 0,
      };
    });

    const campaignIds = donationsByCampaign.map((row) => row._id);
    const campaigns = await CampaignModel.find({ _id: { $in: campaignIds }, deletedAt: null })
      .select('_id category creatorId')
      .lean();
    const campaignCategory = new Map(campaigns.map((campaign) => [campaign._id.toString(), campaign.category]));
    const categoryAmounts = new Map<string, number>();
    for (const row of donationsByCampaign) {
      const category = campaignCategory.get(row._id);
      if (category) categoryAmounts.set(category, (categoryAmounts.get(category) ?? 0) + row.amount);
    }
    const categoryBreakdown = [...categoryAmounts.entries()]
      .map(([category, value]) => ({ category: category.replaceAll('_', ' '), value }))
      .sort((a, b) => b.value - a.value);

    const userIds = [...new Set([...donationsByDonor.map((row) => row._id), ...campaignsByCreator.map((row) => row._id)])];
    const users = await UserModel.find({ _id: { $in: userIds }, deletedAt: null }).select('_id country').lean();
    const userCountry = new Map(users.map((user) => [user._id.toString(), user.country?.trim() || 'Unspecified']));
    const geographic = new Map<string, { campaigns: number; donations: number }>();
    for (const row of campaignsByCreator) {
      const country = userCountry.get(row._id) ?? 'Unspecified';
      const current = geographic.get(country) ?? { campaigns: 0, donations: 0 };
      current.campaigns += row.count;
      geographic.set(country, current);
    }
    for (const row of donationsByDonor) {
      const country = userCountry.get(row._id) ?? 'Unspecified';
      const current = geographic.get(country) ?? { campaigns: 0, donations: 0 };
      current.donations += row.amount;
      geographic.set(country, current);
    }
    const geographicData = [...geographic.entries()]
      .map(([country, values]) => ({ country, ...values }))
      .sort((a, b) => b.donations - a.donations)
      .slice(0, 10);

    const pendingReports = reports.filter((report) => report.status === 'pending').length;
    const flaggedCampaigns = new Set(reports.map((report) => report.campaignId)).size;
    const reportsThisMonth = reports.filter((report) => report.createdAt >= thisMonthStart).length;
    const reportsLastMonth = reports.filter((report) => report.createdAt >= lastMonthStart && report.createdAt < thisMonthStart).length;
    const reportChange = reportsLastMonth > 0 ? round2(((reportsThisMonth - reportsLastMonth) / reportsLastMonth) * 100) : reportsThisMonth > 0 ? 100 : 0;
    const reviewed = reports.filter((report) => report.status !== 'pending' && report.updatedAt && report.createdAt);
    const avgReviewDays = reviewed.length > 0
      ? round2(reviewed.reduce((sum, report) => sum + (report.updatedAt.getTime() - report.createdAt.getTime()) / 86_400_000, 0) / reviewed.length)
      : 0;
    const fraudRate = totalCampaigns > 0 ? round2((flaggedCampaigns / totalCampaigns) * 100) : 0;

    return {
      donationTrend,
      categoryBreakdown,
      geographicData,
      fraudMetrics: [
        { metric: 'Pending Reports', value: pendingReports, change: reportChange },
        { metric: 'Flagged Campaigns', value: flaggedCampaigns, change: reportChange },
        { metric: 'Report Rate', value: fraudRate, change: reportChange },
        { metric: 'Avg Review Time', value: avgReviewDays, change: 0 },
      ],
    };
  }
}
