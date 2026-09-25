import type {
  UserRole,
  VerificationLevel,
  CampaignCategory,
} from '@ubuntu-fund/types';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { ProfileRepositoryPort } from '../../domain/ports/outbound/ProfileRepositoryPort.js';
import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { RefundRepositoryPort } from '../../domain/ports/outbound/RefundRepositoryPort.js';
import type { CampaignEntity } from '../../domain/entities/Campaign.js';
import type { KYCRepositoryPort } from '../../domain/ports/outbound/KYCRepositoryPort.js';
import { currentVerificationLevel } from '../../domain/services/currentVerificationLevel.js';
import {
  ProfileEntity,
  type NotificationPreferences,
} from '../../domain/entities/Profile.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

const RECENT_DONATIONS_LIMIT = 5;
const TOP_CATEGORIES_LIMIT = 3;

export interface ProfileDTO {
  id: string;
  email: string;
  name: string;
  organizationName?: string;
  avatarUrl?: string;
  coverUrl?: string;
  role: UserRole;
  verificationLevel: VerificationLevel;
  trustScore: number;
  country?: string;
  phone?: string;
  bio?: string;
  notificationPreferences: NotificationPreferences;
  preferredCurrency: string;
  language: string;
  darkMode: boolean;
  anonymousDonations: boolean;
  showLeaderboards: boolean;
  publicProfile: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface RecentDonationDTO {
  campaign: string;
  amount: number;
  currency: string;
  date: string;
}

/** Amounts in one currency; never summed across currencies. */
export interface DonatedInCurrencyDTO {
  currency: string;
  gross: number;
  /** Donations with a completed refund. */
  refunded: number;
  net: number;
}

export interface RaisedInCurrencyDTO {
  currency: string;
  raised: number;
}

export interface ProfileImpactDTO extends ProfileDTO {
  /**
   * Legacy single figure for older app builds, which label it GH₵: the net
   * (refunds excluded) total donated in GHS only. Use donatedByCurrency.
   */
  totalDonated: number;
  donatedByCurrency: DonatedInCurrencyDTO[];
  raisedByCurrency: RaisedInCurrencyDTO[];
  donationCount: number;
  campaignsSupported: number;
  campaignsCreated: number;
  topCategories: CampaignCategory[];
  recentDonations: RecentDonationDTO[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export class GetProfileUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly profileRepo: ProfileRepositoryPort,
    private readonly donationRepo: DonationRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly refundRepo?: RefundRepositoryPort,
    /**
     * When wired, the owner's own profile reports the CURRENT evidence-backed
     * level (the same projection public views use), not the stored historical
     * maximum, so an expired or superseded verification is not shown as held.
     */
    private readonly kycRepo?: Pick<KYCRepositoryPort, 'findByUserId'>
  ) {}

  async execute(userId: string): Promise<ProfileImpactDTO> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const [existingProfile, donations, campaignsCreated, createdCampaigns] = await Promise.all([
      this.profileRepo.findByUserId(userId),
      this.donationRepo.findByDonorId(userId),
      this.campaignRepo.countByCreatorId(userId),
      this.campaignRepo.findByCreatorId(userId),
    ]);

    const profileEntity = existingProfile ?? ProfileEntity.createDefault(userId);
    const profilePlain = profileEntity.toPlain();

    // Per currency, never mixed; a completed refund removes that donation.
    const refunds = this.refundRepo && donations.length
      ? await this.refundRepo.findByDonationIds(donations.map((donation) => donation.id))
      : [];
    const refundedDonations = new Set(refunds.filter((refund) => refund.status === 'completed').map((refund) => refund.donationId));
    const donated = new Map<string, DonatedInCurrencyDTO>();
    for (const donation of donations) {
      const currency = donation.amount.currency;
      const entry = donated.get(currency) ?? { currency, gross: 0, refunded: 0, net: 0 };
      entry.gross += donation.amount.amount;
      if (refundedDonations.has(donation.id)) entry.refunded += donation.amount.amount;
      donated.set(currency, entry);
    }
    const donatedByCurrency = [...donated.values()]
      .map((entry) => ({ currency: entry.currency, gross: round2(entry.gross), refunded: round2(entry.refunded), net: round2(entry.gross - entry.refunded) }))
      .sort((a, b) => b.net - a.net || a.currency.localeCompare(b.currency));
    const raised = new Map<string, number>();
    for (const campaign of createdCampaigns) {
      if (campaign.raisedAmount.amount <= 0) continue;
      raised.set(campaign.raisedAmount.currency, (raised.get(campaign.raisedAmount.currency) ?? 0) + campaign.raisedAmount.amount);
    }
    const raisedByCurrency = [...raised.entries()]
      .map(([currency, amount]) => ({ currency, raised: round2(amount) }))
      .sort((a, b) => b.raised - a.raised || a.currency.localeCompare(b.currency));
    const totalDonated = donatedByCurrency.find((entry) => entry.currency === 'GHS')?.net ?? 0;
    const campaignsSupported = new Set(donations.map((d) => d.campaignId))
      .size;

    const recent = donations.slice(0, RECENT_DONATIONS_LIMIT);
    const uniqueCampaignIds = Array.from(
      new Set(recent.map((d) => d.campaignId))
    );

    const campaignCache = new Map<string, CampaignEntity | null>();
    await Promise.all(
      uniqueCampaignIds.map(async (campaignId) => {
        campaignCache.set(campaignId, await this.campaignRepo.findById(campaignId));
      })
    );

    const recentDonations: RecentDonationDTO[] = recent.map((donation) => {
      const campaign = campaignCache.get(donation.campaignId);
      return {
        campaign: campaign ? campaign.title : 'Unknown Campaign',
        amount: donation.amount.amount,
        currency: donation.amount.currency,
        date: donation.createdAt.toISOString(),
      };
    });

    const categoryTally = new Map<CampaignCategory, number>();
    for (const campaign of campaignCache.values()) {
      if (!campaign) continue;
      categoryTally.set(
        campaign.category,
        (categoryTally.get(campaign.category) ?? 0) + 1
      );
    }
    const topCategories = Array.from(categoryTally.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_CATEGORIES_LIMIT)
      .map(([category]) => category);

    const userPlain = user.toPlain();

    return {
      id: userPlain.id,
      email: userPlain.email.value,
      name: userPlain.name,
      organizationName: userPlain.organizationName,
      avatarUrl: userPlain.avatarUrl,
      coverUrl: userPlain.coverUrl,
      role: userPlain.role,
      verificationLevel: this.kycRepo
        ? currentVerificationLevel(user, await this.kycRepo.findByUserId(userId))
        : userPlain.verificationLevel,
      trustScore: userPlain.trustScore.value,
      country: userPlain.country,
      phone: profilePlain.phone,
      bio: profilePlain.bio,
      notificationPreferences: profilePlain.notificationPreferences,
      preferredCurrency: profilePlain.preferredCurrency,
      language: profilePlain.language,
      darkMode: profilePlain.darkMode,
      anonymousDonations: profilePlain.anonymousDonations,
      showLeaderboards: profilePlain.showLeaderboards,
      publicProfile: profilePlain.publicProfile,
      createdAt: userPlain.createdAt,
      updatedAt: userPlain.updatedAt,
      totalDonated,
      donatedByCurrency,
      raisedByCurrency,
      donationCount: donations.length,
      campaignsSupported,
      campaignsCreated,
      topCategories,
      recentDonations,
    };
  }
}
