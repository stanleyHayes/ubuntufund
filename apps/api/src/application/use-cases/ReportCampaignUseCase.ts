import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type {
  ReportRepositoryPort,
  ReportReason,
} from '../../domain/ports/outbound/ReportRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface ReportCampaignInput {
  campaignId: string;
  reason: ReportReason;
  description?: string;
}

export class ReportCampaignUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly reportRepo: ReportRepositoryPort
  ) {}

  async execute(input: ReportCampaignInput, reporterId: string): Promise<void> {
    const campaign = await this.campaignRepo.findById(input.campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.creatorId === reporterId) {
      throw new AppError('You cannot report your own campaign', 403);
    }

    const alreadyReported = await this.reportRepo.existsByCampaignAndReporter(
      input.campaignId,
      reporterId
    );
    if (alreadyReported) {
      throw new AppError('You have already reported this campaign', 409);
    }

    await this.reportRepo.save({
      id: '',
      campaignId: input.campaignId,
      reporterId,
      reason: input.reason,
      description: input.description,
      status: 'pending',
      createdAt: new Date(),
    });
  }
}
