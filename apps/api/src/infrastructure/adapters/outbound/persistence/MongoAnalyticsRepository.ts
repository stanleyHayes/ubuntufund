import { isObjectIdOrHexString, type PipelineStage } from 'mongoose';
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
import { DonationIntentModel } from '../../../database/models/DonationIntentModel.js';
import { fromMinorUnits } from '../../../../domain/value-objects/Money.js';
import { GUEST_DONOR_ID } from '../../../../domain/entities/Donation.js';

interface StatusCountRaw {
  _id: string;
  count: number;
}

interface DonationTotalsRaw {
  _id: string;
  totalRaised: number;
  totalDonations: number;
  distinctDonors: (string | null)[];
}
interface RefundedRaw<K> { _id: K; minor: number }

/** The platform currency; legacy donation rows without a currency are GHS. */
const BASE_CURRENCY = 'GHS';
const BASE_CURRENCY_MATCH = { $or: [{ currency: BASE_CURRENCY }, { currency: { $exists: false } }, { currency: null }] };
/** Refunds are recorded on the payment (DonationIntent) in settlement minor units. */
const REFUNDED_INTENTS: PipelineStage.Match = { $match: { refundedAmountMinor: { $gt: 0 } } };
const BASE_REFUNDS: PipelineStage.Match = { $match: { $expr: { $eq: [{ $ifNull: ['$settlementCurrency', '$currency'] }, BASE_CURRENCY] } } };
const major = (minor: number) => fromMinorUnits(minor, BASE_CURRENCY);

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
      refundedByCurrency,
    ] = await Promise.all([
      UserModel.countDocuments({ deletedAt: null }),
      CampaignModel.aggregate<StatusCountRaw>([
        { $match: { deletedAt: null } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ] as PipelineStage[]),
      DonationModel.aggregate<DonationTotalsRaw>([
        {
          $group: {
            _id: { $ifNull: ['$currency', BASE_CURRENCY] },
            totalRaised: { $sum: '$amount' },
            totalDonations: { $sum: 1 },
            // Guests share donorId 'guest', which is not an account: leave
            // it out of the donor-accounts figure used for conversion.
            distinctDonors: { $addToSet: { $cond: [{ $eq: ['$donorId', 'guest'] }, null, '$donorId'] } },
          },
        },
      ] as PipelineStage[]),
      ReportModel.countDocuments({ status: 'pending' }),
      UserModel.countDocuments({ deletedAt: null, createdAt: { $gte: thisMonthStart } }),
      UserModel.countDocuments({
        deletedAt: null,
        createdAt: { $gte: lastMonthStart, $lt: thisMonthStart },
      }),
      DonationIntentModel.aggregate<RefundedRaw<string>>([
        REFUNDED_INTENTS,
        { $group: { _id: { $ifNull: ['$settlementCurrency', '$currency'] }, minor: { $sum: '$refundedAmountMinor' } } },
      ] as PipelineStage[]),
    ]);

    const campaignsByStatus: Record<string, number> = Object.fromEntries(
      Object.values(CampaignStatus).map((status) => [status, 0])
    );
    for (const entry of campaignStatusCounts) {
      campaignsByStatus[entry._id] = entry.count;
    }
    const activeCampaigns = campaignsByStatus[CampaignStatus.ACTIVE] ?? 0;

    // Refunds never edit donation rows; subtract them per currency so every
    // figure is net, and never add other currencies into the GHS total.
    const refunded = new Map(refundedByCurrency.map((row) => [String(row._id).toUpperCase(), fromMinorUnits(row.minor, String(row._id))]));
    const totalRaisedByCurrency: Record<string, number> = {};
    for (const row of donationTotals) {
      const currency = String(row._id).toUpperCase();
      totalRaisedByCurrency[currency] = round2((totalRaisedByCurrency[currency] ?? 0) + row.totalRaised);
    }
    for (const [currency, amount] of refunded) {
      totalRaisedByCurrency[currency] = round2((totalRaisedByCurrency[currency] ?? 0) - amount);
    }
    const totalRaised = totalRaisedByCurrency[BASE_CURRENCY] ?? 0;
    const totalDonations = donationTotals.reduce((sum, row) => sum + row.totalDonations, 0);
    const baseDonations = donationTotals.filter((row) => String(row._id).toUpperCase() === BASE_CURRENCY)
      .reduce((sum, row) => sum + row.totalDonations, 0);
    // Guests are grouped as null and are not donor accounts.
    const distinctDonorCount = new Set(donationTotals.flatMap((row) => row.distinctDonors).filter((id) => id !== null)).size;
    const avgDonation =
      baseDonations > 0 ? round2(totalRaised / baseDonations) : 0;
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
      totalRaisedByCurrency,
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

    // Report amounts are shown in GHS: only GHS donations, net of their refunds.
    // A refund is attributed to its payment's creation month in the trend.
    const [monthlyRows, donationsByCampaign, donationsByDonor, campaignsByCreator, reports, totalCampaigns, refundedByMonth, refundedByCampaign, refundedByDonor] = await Promise.all([
      DonationModel.aggregate<MonthlyDonationRaw>([
        { $match: { createdAt: { $gte: trendStart }, ...BASE_CURRENCY_MATCH } },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, amount: { $sum: '$amount' } } },
      ] as PipelineStage[]),
      DonationModel.aggregate<AmountByIdRaw>([{ $match: BASE_CURRENCY_MATCH }, { $group: { _id: '$campaignId', amount: { $sum: '$amount' } } }] as PipelineStage[]),
      DonationModel.aggregate<AmountByIdRaw>([{ $match: BASE_CURRENCY_MATCH }, { $group: { _id: '$donorId', amount: { $sum: '$amount' } } }] as PipelineStage[]),
      CampaignModel.aggregate<CountByIdRaw>([
        { $match: { deletedAt: null } },
        { $group: { _id: '$creatorId', count: { $sum: 1 } } },
      ] as PipelineStage[]),
      ReportModel.find().select('campaignId status createdAt updatedAt').lean(),
      CampaignModel.countDocuments({ deletedAt: null }),
      DonationIntentModel.aggregate<RefundedRaw<{ year: number; month: number }>>([
        REFUNDED_INTENTS, BASE_REFUNDS, { $match: { createdAt: { $gte: trendStart } } },
        { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, minor: { $sum: '$refundedAmountMinor' } } },
      ] as PipelineStage[]),
      DonationIntentModel.aggregate<RefundedRaw<string>>([REFUNDED_INTENTS, BASE_REFUNDS, { $group: { _id: '$campaignId', minor: { $sum: '$refundedAmountMinor' } } }] as PipelineStage[]),
      DonationIntentModel.aggregate<RefundedRaw<string>>([REFUNDED_INTENTS, BASE_REFUNDS, { $group: { _id: { $ifNull: ['$donorUserId', GUEST_DONOR_ID] }, minor: { $sum: '$refundedAmountMinor' } } }] as PipelineStage[]),
    ]);
    const net = (rows: AmountByIdRaw[], refundRows: RefundedRaw<string>[]): AmountByIdRaw[] => {
      const amounts = new Map(rows.map((row) => [row._id, row.amount]));
      for (const refund of refundRows) amounts.set(refund._id, round2((amounts.get(refund._id) ?? 0) - major(refund.minor)));
      return [...amounts.entries()].map(([_id, amount]) => ({ _id, amount }));
    };
    const netByCampaign = net(donationsByCampaign, refundedByCampaign);
    const netByDonor = net(donationsByDonor, refundedByDonor);

    const monthAmounts = new Map(monthlyRows.map((row) => [`${row._id.year}-${row._id.month}`, row.amount]));
    for (const refund of refundedByMonth) {
      const key = `${refund._id.year}-${refund._id.month}`;
      monthAmounts.set(key, round2((monthAmounts.get(key) ?? 0) - major(refund.minor)));
    }
    const donationTrend = Array.from({ length: 9 }, (_, index) => {
      const date = monthStart(now, 8 - index);
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        amount: monthAmounts.get(`${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`) ?? 0,
      };
    });

    const campaignIds = netByCampaign.map((row) => row._id).filter(isObjectIdOrHexString);
    const campaigns = await CampaignModel.find({ _id: { $in: campaignIds }, deletedAt: null })
      .select('_id category creatorId')
      .lean();
    const campaignCategory = new Map(campaigns.map((campaign) => [campaign._id.toString(), campaign.category]));
    const categoryAmounts = new Map<string, number>();
    for (const row of netByCampaign) {
      const category = campaignCategory.get(row._id);
      if (category) categoryAmounts.set(category, (categoryAmounts.get(category) ?? 0) + row.amount);
    }
    const categoryBreakdown = [...categoryAmounts.entries()]
      .map(([category, value]) => ({ category: category.replaceAll('_', ' '), value }))
      .sort((a, b) => b.value - a.value);

    const userIds = [...new Set([...netByDonor.map((row) => row._id), ...campaignsByCreator.map((row) => row._id)])];
    // Guest/system donor identifiers are valid donation records, not Mongo user IDs.
    const users = await UserModel.find({ _id: { $in: userIds.filter(isObjectIdOrHexString) }, deletedAt: null }).select('_id country').lean();
    const userCountry = new Map(users.map((user) => [user._id.toString(), user.country?.trim() || 'Unspecified']));
    const geographic = new Map<string, { campaigns: number; donations: number }>();
    for (const row of campaignsByCreator) {
      const country = userCountry.get(row._id) ?? 'Unspecified';
      const current = geographic.get(country) ?? { campaigns: 0, donations: 0 };
      current.campaigns += row.count;
      geographic.set(country, current);
    }
    for (const row of netByDonor) {
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
