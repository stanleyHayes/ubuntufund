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
  email: string;
  country: string;
  verified: boolean;
  avatarUrl?: string;
  createdAt: Date;
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
  campaignCount: number;
  totalRaised: number;
  currency: string;
  followerCount: number;
  categories: CampaignCategory[];
}

const DEFAULT_CURRENCY = 'ZAR';

function isVerified(record: OrganizationRecord): boolean {
  return record.verificationLevel >= VerificationLevel.INSTITUTIONAL;
}

function toSummary(record: OrganizationRecord): OrganizationSummary {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    country: record.country ?? '',
    verified: isVerified(record),
    avatarUrl: record.avatarUrl,
    createdAt: record.createdAt,
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
    private readonly campaignRepo: CampaignRepositoryPort
  ) {}

  async list(): Promise<OrganizationSummary[]> {
    const records = await this.organizationRepo.findAll();
    return records.map(toSummary);
  }

  async getBySlugOrId(slugOrId: string): Promise<OrganizationDetail> {
    const record = await this.organizationRepo.findBySlugOrId(slugOrId);
    if (!record) {
      throw new AppError('Organization not found', 404);
    }

    const campaigns = await this.campaignRepo.findByCreatorId(record.id);
    const currency = campaigns[0]?.toPlain().goalAmount.currency ?? DEFAULT_CURRENCY;
    const totalRaised = campaigns.reduce(
      (sum, c) => sum + c.toPlain().raisedAmount.amount,
      0
    );
    const categories = [
      ...new Set(campaigns.map((c) => c.toPlain().category)),
    ];

    const summary = toSummary(record);

    return {
      ...summary,
      slug: deriveOrganizationSlug(record.name),
      description: '',
      logoUrl: record.avatarUrl ?? '',
      coverUrl: '',
      city: '',
      website: record.website,
      founded: record.createdAt.getFullYear(),
      impactStatement:
        campaigns.length > 0
          ? `${record.name} has raised ${currency} ${totalRaised.toLocaleString()} across ${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} on Ubuntu Fund.`
          : `${record.name} is a verified organization on Ubuntu Fund.`,
      campaignCount: campaigns.length,
      totalRaised,
      currency,
      followerCount: 0,
      categories,
    };
  }

  async getCampaigns(organizationId: string): Promise<Campaign[]> {
    const record = await this.organizationRepo.findById(organizationId);
    if (!record) {
      throw new AppError('Organization not found', 404);
    }

    const campaigns = await this.campaignRepo.findByCreatorId(organizationId);
    return campaigns.map(toCampaignDTO);
  }
}
