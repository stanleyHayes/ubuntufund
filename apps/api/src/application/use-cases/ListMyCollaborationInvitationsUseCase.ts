import { CollaborationStatus, type CampaignCollaborator } from '@ubuntu-fund/types';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { CollaborationRepositoryPort } from '../../domain/ports/outbound/CollaborationRepositoryPort.js';
import { toCollaboratorDto } from './mappers/collaborationDto.js';

/**
 * CampaignCollaborator plus a convenience `campaignName` field. This field is
 * not part of the shared @ubuntu-fund/types contract (which only knows the
 * campaignId), so it is defined locally here. The frontend reads it
 * defensively as an optional extra property.
 */
export interface CampaignCollaboratorWithCampaignName
  extends CampaignCollaborator {
  campaignName?: string;
}

export class ListMyCollaborationInvitationsUseCase {
  constructor(
    private readonly collaborationRepo: CollaborationRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort
  ) {}

  async execute(
    userId: string
  ): Promise<CampaignCollaboratorWithCampaignName[]> {
    const collaborations = await this.collaborationRepo.findByUserId(userId);
    const pending = collaborations.filter(
      (c) => c.status === CollaborationStatus.PENDING
    );

    const results: CampaignCollaboratorWithCampaignName[] = [];
    for (const collaboration of pending) {
      const campaign = await this.campaignRepo.findById(
        collaboration.campaignId
      );
      results.push({
        ...toCollaboratorDto(collaboration),
        campaignName: campaign?.title,
      });
    }
    return results;
  }
}
