import { CollaborationStatus, type CampaignCollaborator } from '@ubuntu-fund/types';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { CollaborationRepositoryPort } from '../../domain/ports/outbound/CollaborationRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { toCollaboratorDto } from './mappers/collaborationDto.js';

export class ListCampaignCollaboratorsUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly collaborationRepo: CollaborationRepositoryPort
  ) {}

  async execute(campaignId: string, requesterId?: string): Promise<CampaignCollaborator[]> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const collaborations =
      await this.collaborationRepo.findByCampaignId(campaignId);

    // Pending invitations identify people who never consented to appear on a
    // public page — only the campaign owner may see them.
    const isOwner = requesterId !== undefined && requesterId === campaign.creatorId;

    return collaborations
      .filter(
        (c) =>
          c.status === CollaborationStatus.ACCEPTED ||
          (isOwner && c.status === CollaborationStatus.PENDING)
      )
      .map(toCollaboratorDto);
  }
}
