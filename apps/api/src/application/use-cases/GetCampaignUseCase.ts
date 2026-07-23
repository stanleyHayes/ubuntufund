import type { Campaign, PaginationParams, PaginatedResponse } from '@ubuntu-fund/types';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { CampaignEntity } from '../../domain/entities/Campaign.js';

function toDTO(entity: CampaignEntity): Campaign {
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

export class GetCampaignUseCase {
  constructor(private readonly campaignRepo: CampaignRepositoryPort) {}

  async getById(id: string): Promise<Campaign | null> {
    const entity = await this.campaignRepo.findById(id);
    return entity ? toDTO(entity) : null;
  }

  async list(params: PaginationParams): Promise<PaginatedResponse<Campaign>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const { items, total } = await this.campaignRepo.findAll({
      ...params,
      page,
      pageSize,
    });

    return {
      items: items.map(toDTO),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
