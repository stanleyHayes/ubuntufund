import type { CampaignCollaborator } from '@ubuntu-fund/types';
import type { CollaborationRepositoryPort } from '../../domain/ports/outbound/CollaborationRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { toCollaboratorDto } from './mappers/collaborationDto.js';

export interface RespondToCollaborationRequest {
  collaborationId: string;
  accept: boolean;
  declineReason?: string;
}

export class RespondToCollaborationUseCase {
  constructor(private readonly collaborationRepo: CollaborationRepositoryPort) {}

  async execute(
    input: RespondToCollaborationRequest,
    userId: string
  ): Promise<CampaignCollaborator> {
    const collaboration = await this.collaborationRepo.findById(
      input.collaborationId
    );
    if (!collaboration) {
      throw new AppError('Invitation not found', 404);
    }
    if (collaboration.userId !== userId) {
      throw new AppError('You are not the invited collaborator', 403);
    }
    if (!collaboration.isPending()) {
      throw new AppError(
        'This invitation has already been responded to',
        409
      );
    }

    if (input.accept) {
      collaboration.accept();
    } else {
      collaboration.decline();
    }

    const updated = await this.collaborationRepo.update(collaboration);
    return toCollaboratorDto(updated);
  }
}
