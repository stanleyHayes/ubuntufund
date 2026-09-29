import { campaignReviewVersion } from '../../domain/services/campaignReviewVersion.js';
import { isPublicCampaign } from '../../domain/services/campaignVisibility.js';
import type { Campaign, PaginatedResponse } from '@ubuntu-fund/types';
import type { CampaignListQuery, CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type { CampaignEntity } from '../../domain/entities/Campaign.js';
import { campaignOnBehalfSummary, campaignViewerAccess } from './mappers/campaignOnBehalf.js';

function toDTO(entity: CampaignEntity): Campaign {
  const plain = entity.toPlain();
  return {
    id: plain.id,
    slug: plain.slug || undefined,
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
    tier: plain.tier,
    creationMode: entity.creationMode,
    onBehalf: campaignOnBehalfSummary(entity),
  };
}

export class GetCampaignUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly donationRepo?: DonationRepositoryPort,
    /** Resolves org admins/editors as managers. Absent: only the creator manages. */
    private readonly access?: { managerRole(campaign: { creatorId: string }, userId: string | undefined): Promise<string | null> }
  ) {}

  async getById(id: string, viewerId?: string, isAdmin = false): Promise<Campaign | null> {
    const entity = await this.campaignRepo.findById(id);
    // The linked beneficiary may see a campaign run for them before it is public.
    const isBeneficiary = !!viewerId && entity?.onBehalf?.beneficiaryUserId === viewerId;
    if (!entity || (!isPublicCampaign(entity.status) && entity.creatorId !== viewerId && !isBeneficiary && !isAdmin)) return null;
    const dto = toDTO(entity);
    if (viewerId) {
      const isManager = entity.creatorId === viewerId || (!!this.access && !!(await this.access.managerRole(entity, viewerId)));
      dto.viewerAccess = campaignViewerAccess(entity, viewerId, isManager);
    }
    if (isAdmin) { dto.reviewVersion = campaignReviewVersion(entity); dto.lockedPlatformFeePercent = entity.lockedPlatformFeePercent; }
    if (this.donationRepo) {
      const counts = await this.donationRepo.countDistinctDonorsByCampaignIds([dto.id]);
      dto.donorCount = counts[dto.id] ?? 0;
    }
    return dto;
  }

  async list(params: Omit<CampaignListQuery, 'includeNonPublic'>, isAdmin = false): Promise<PaginatedResponse<Campaign>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const { items, total } = await this.campaignRepo.findAll({
      ...params,
      includeNonPublic: isAdmin,
      page,
      pageSize,
    });

    const dtos = items.map(toDTO);
    if (this.donationRepo && dtos.length > 0) {
      const counts = await this.donationRepo.countDistinctDonorsByCampaignIds(dtos.map((d) => d.id));
      for (const dto of dtos) dto.donorCount = counts[dto.id] ?? 0;
    }

    return {
      items: dtos,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async listByCreator(creatorId: string): Promise<Campaign[]> {
    const items = await this.campaignRepo.findByCreatorId(creatorId);
    const dtos = items.map(toDTO);
    if (this.donationRepo && dtos.length > 0) {
      const counts = await this.donationRepo.countDistinctDonorsByCampaignIds(
        dtos.map((campaign) => campaign.id)
      );
      for (const dto of dtos) dto.donorCount = counts[dto.id] ?? 0;
    }
    return dtos;
  }
}
