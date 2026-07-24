import type { PaginatedResponse } from '@ubuntu-fund/types';
import type {
  DisputeRepositoryPort,
  DisputeRecord,
  DisputeListParams,
  DisputeStatus,
} from '../../domain/ports/outbound/DisputeRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';

export interface DisputeDTO {
  id: string;
  campaignId: string;
  campaignTitle: string;
  reporterId: string;
  reporterName: string;
  assigneeId?: string;
  assigneeName?: string;
  reason: string;
  description?: string;
  status: DisputeStatus;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class GetDisputeUseCase {
  constructor(
    private readonly disputeRepo: DisputeRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly userRepo: UserRepositoryPort
  ) {}

  async getById(id: string): Promise<DisputeDTO | null> {
    const dispute = await this.disputeRepo.findById(id);
    return dispute ? this.toDTO(dispute) : null;
  }

  async list(params: DisputeListParams): Promise<PaginatedResponse<DisputeDTO>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const { items, total } = await this.disputeRepo.findAll({
      ...params,
      page,
      pageSize,
    });

    const dtos = await Promise.all(items.map((item) => this.toDTO(item)));

    return {
      items: dtos,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private async toDTO(dispute: DisputeRecord): Promise<DisputeDTO> {
    const [campaign, reporter, assignee] = await Promise.all([
      this.campaignRepo.findById(dispute.campaignId),
      this.userRepo.findById(dispute.reporterId),
      dispute.assigneeId
        ? this.userRepo.findById(dispute.assigneeId)
        : Promise.resolve(null),
    ]);

    return {
      id: dispute.id,
      campaignId: dispute.campaignId,
      campaignTitle: campaign ? campaign.title : 'Unknown campaign',
      reporterId: dispute.reporterId,
      reporterName: reporter ? reporter.name : 'Unknown user',
      assigneeId: dispute.assigneeId,
      assigneeName: assignee ? assignee.name : undefined,
      reason: dispute.reason,
      description: dispute.description,
      status: dispute.status,
      resolution: dispute.resolution,
      resolvedBy: dispute.resolvedBy,
      resolvedAt: dispute.resolvedAt,
      createdAt: dispute.createdAt,
      updatedAt: dispute.updatedAt,
    };
  }
}
