import type { PaginatedResponse } from '@ubuntu-fund/types';
import type {
  AdminReportRepositoryPort,
  ReportListParams,
} from '../../domain/ports/outbound/AdminReportRepositoryPort.js';
import type {
  ReportRecord,
  ReportReason,
  ReportStatus,
} from '../../domain/ports/outbound/ReportRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';

export interface ReportDTO {
  id: string;
  campaignId: string;
  campaignTitle: string;
  reporterId: string;
  reason: ReportReason;
  description?: string;
  status: ReportStatus;
  createdAt: Date;
}

export class ListReportsUseCase {
  constructor(
    private readonly reportRepo: AdminReportRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort
  ) {}

  async getById(id: string): Promise<ReportDTO | null> {
    const report = await this.reportRepo.findById(id);
    return report ? this.toDTO(report) : null;
  }

  async list(params: ReportListParams): Promise<PaginatedResponse<ReportDTO>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;

    const { items, total } = await this.reportRepo.findAll({
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

  private async toDTO(report: ReportRecord): Promise<ReportDTO> {
    const campaign = await this.campaignRepo.findById(report.campaignId);
    return {
      id: report.id,
      campaignId: report.campaignId,
      campaignTitle: campaign ? campaign.title : 'Unknown campaign',
      reporterId: report.reporterId,
      reason: report.reason,
      description: report.description,
      status: report.status,
      createdAt: report.createdAt,
    };
  }
}
