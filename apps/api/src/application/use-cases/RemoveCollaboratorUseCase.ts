import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { CollaborationRepositoryPort } from '../../domain/ports/outbound/CollaborationRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface RemoveCollaboratorRequest {
  campaignId: string;
  /** id of the CampaignCollaborator (collaboration) record to remove */
  collaborationId: string;
}

export class RemoveCollaboratorUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly collaborationRepo: CollaborationRepositoryPort
  ) {}

  async execute(
    input: RemoveCollaboratorRequest,
    requesterId: string
  ): Promise<void> {
    const campaign = await this.campaignRepo.findById(input.campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const collaboration = await this.collaborationRepo.findById(
      input.collaborationId
    );
    if (!collaboration || collaboration.campaignId !== input.campaignId) {
      throw new AppError('Collaborator not found', 404);
    }

    const isOwner = campaign.creatorId === requesterId;
    const isSelf = collaboration.userId === requesterId;
    if (!isOwner && !isSelf) {
      throw new AppError(
        'You do not have permission to remove this collaborator',
        403
      );
    }

    collaboration.remove();
    await this.collaborationRepo.update(collaboration);
  }
}
