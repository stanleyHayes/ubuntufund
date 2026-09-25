import type { KYCRepositoryPort } from '../../domain/ports/outbound/KYCRepositoryPort.js';
import type { PublicProfileVisibilityPort } from '../../domain/ports/outbound/PublicProfileVisibilityPort.js';
import { isPublicCampaign } from '../../domain/services/campaignVisibility.js';
import type { Campaign, CampaignCategory } from '@ubuntu-fund/types';
import { VerificationLevel } from '@ubuntu-fund/types';
import type { OrganizationRepositoryPort } from '../../domain/ports/outbound/OrganizationRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { OrganizationRecord } from '../../domain/entities/Organization.js';
import { deriveOrganizationSlug } from '../../domain/entities/Organization.js';
import type { CampaignEntity } from '../../domain/entities/Campaign.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** Response shape for GET /organizations — kept intentionally minimal. */
export interface OrganizationSummary {
  id: string;
  name: string;
  country: string;
  verified: boolean;
  avatarUrl?: string;
  createdAt: Date;
  /** Public campaigns, and what they raised in `currency` (other currencies are not added in). */
  campaignCount: number;
  totalRaised: number;
  currency: string;
}

/** Response shape for GET /organizations/:slug — enriched with campaign stats. */
export interface OrganizationDetail extends OrganizationSummary {
  slug: string;
  description: string;
  logoUrl: string;
  coverUrl: string;
  city: string;
  website?: string;
  founded: number;
  impactStatement: string;
  followerCount: number;
  categories: CampaignCategory[];
}

const DEFAULT_CURRENCY = 'GHS';

/**
 * Campaign totals in the platform currency only: adding amounts raised in
 * different currencies and labelling the sum with one of them misstates it.
 */
function campaignStats(campaigns: CampaignEntity[]): { campaignCount: number; totalRaised: number; currency: string } {
  const totalRaised = campaigns
    .filter(campaign => campaign.goalAmount.currency === DEFAULT_CURRENCY)
    .reduce((sum, campaign) => sum + campaign.raisedAmount.amount, 0);
  return { campaignCount: campaigns.length, totalRaised, currency: DEFAULT_CURRENCY };
}

function toSummary(record: OrganizationRecord, verified: boolean, campaigns: CampaignEntity[]): OrganizationSummary {
  return {
    id: record.id,
    name: record.name,
    country: record.country ?? '',
    verified,
    avatarUrl: record.avatarUrl,
    createdAt: record.createdAt,
    ...campaignStats(campaigns),
  };
}

function toCampaignDTO(entity: CampaignEntity): Campaign {
  const plain = entity.toPlain();
  return {
    id: plain.id,
    title: plain.title,
    description: plain.description,
    goalAmount: plain.goalAmount.amount,
    raisedAmount: plain.raisedAmount.amount,
    currency: plain.goalAmount.currency,
    category: plain.category,
    priority: plain.priority,
    status: plain.status,
    creatorId: plain.creatorId,
    beneficiaries: plain.beneficiaries,
    imageUrls: plain.imageUrls,
    startDate: plain.startDate,
    endDate: plain.endDate,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

export class GetOrganizationUseCase {
  constructor(
    private readonly organizationRepo: OrganizationRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly visibility: PublicProfileVisibilityPort,
    private readonly kycRepo: KYCRepositoryPort
  ) {}

  private async isVerified(record: OrganizationRecord): Promise<boolean> {
    if (record.verificationLevel < VerificationLevel.INSTITUTIONAL) return false;
    const latest = (await this.kycRepo.findByUserId(record.id))
      .filter(review => review.verificationType === 'business')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id.localeCompare(a.id))[0];
    const expiry = latest?.expiryDate ? new Date(latest.expiryDate).getTime() : NaN;
    return latest?.status === 'approved' && Number.isFinite(expiry) && expiry > Date.now();
  }

  async list(viewerId?: string): Promise<OrganizationSummary[]> {
    const records = await this.organizationRepo.findAll();
    const hidden = await this.visibility.hiddenUserIds(records.map(record => record.id), viewerId);
    return Promise.all(records.filter(record => !hidden.has(record.id)).map(async record => toSummary(record, await this.isVerified(record), await this.publicCampaigns(record.id))));
  }

  private async publicCampaigns(organizationId: string): Promise<CampaignEntity[]> {
    return (await this.campaignRepo.findByCreatorId(organizationId)).filter(campaign => isPublicCampaign(campaign.status));
  }

  async getBySlugOrId(slugOrId: string, viewerId?: string): Promise<OrganizationDetail> {
    const record = await this.organizationRepo.findBySlugOrId(slugOrId);
    if (!record || (await this.visibility.hiddenUserIds([record.id], viewerId)).has(record.id)) {
      throw new AppError('Organization not found', 404);
    }

    const campaigns = await this.publicCampaigns(record.id);
    const { totalRaised, currency } = campaignStats(campaigns);
    const categories = [
      ...new Set(campaigns.map((c) => c.toPlain().category)),
    ];

    const summary = toSummary(record, await this.isVerified(record), campaigns);

    return {
      ...summary,
      slug: deriveOrganizationSlug(record.name),
      description: '',
      logoUrl: record.avatarUrl ?? '',
      coverUrl: record.coverUrl ?? '',
      city: '',
      website: record.website,
      founded: record.createdAt.getFullYear(),
      impactStatement:
        campaigns.length > 0
          ? `${record.name} has raised ${currency} ${totalRaised.toLocaleString()} across ${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} on Ujimora.`
          : `${record.name} is an organization on Ujimora.`,
      followerCount: 0,
      categories,
    };
  }

  async getCampaigns(organizationId: string, viewerId?: string): Promise<Campaign[]> {
    const record = await this.organizationRepo.findById(organizationId);
    if (!record || (await this.visibility.hiddenUserIds([record.id], viewerId)).has(record.id)) {
      throw new AppError('Organization not found', 404);
    }

    const campaigns = (await this.campaignRepo.findByCreatorId(organizationId)).filter(campaign => isPublicCampaign(campaign.status));
    return campaigns.map(toCampaignDTO);
  }
}
