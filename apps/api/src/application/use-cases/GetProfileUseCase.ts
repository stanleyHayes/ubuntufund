import type {
  UserRole,
  VerificationLevel,
  CampaignCategory,
} from '@ubuntu-fund/types';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { ProfileRepositoryPort } from '../../domain/ports/outbound/ProfileRepositoryPort.js';
import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { CampaignEntity } from '../../domain/entities/Campaign.js';
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
  avatarUrl?: string;
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

export interface RecentDonationDTO {
  campaign: string;
  amount: number;
  currency: string;
  date: string;
}

export interface BadgeDTO {
  icon: string;
  label: string;
  desc: string;
}

export interface ProfileImpactDTO extends ProfileDTO {
  totalDonated: number;
  donationCount: number;
  campaignsSupported: number;
  campaignsCreated: number;
  streak: number;
  rank: number;
  followers: number;
  following: number;
  bookmarks: number;
  topCategories: CampaignCategory[];
  interestedCategories: CampaignCategory[];
  recentDonations: RecentDonationDTO[];
  badges: BadgeDTO[];
}

export class GetProfileUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly profileRepo: ProfileRepositoryPort,
    private readonly donationRepo: DonationRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort
  ) {}

  async execute(userId: string): Promise<ProfileImpactDTO> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const [existingProfile, donations, campaignsCreated] = await Promise.all([
      this.profileRepo.findByUserId(userId),
      this.donationRepo.findByDonorId(userId),
      this.campaignRepo.countByCreatorId(userId),
    ]);

    const profileEntity = existingProfile ?? ProfileEntity.createDefault(userId);
    const profilePlain = profileEntity.toPlain();

    const totalDonated = donations.reduce(
      (sum, donation) => sum + donation.amount.amount,
      0
    );
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
      avatarUrl: userPlain.avatarUrl,
      role: userPlain.role,
      verificationLevel: userPlain.verificationLevel,
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
      donationCount: donations.length,
      campaignsSupported,
      campaignsCreated,
      streak: 0,
      rank: 0,
      followers: 0,
      following: 0,
      bookmarks: 0,
      topCategories,
      interestedCategories: [],
      recentDonations,
      badges: [],
    };
  }
}
