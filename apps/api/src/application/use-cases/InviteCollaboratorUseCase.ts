import {
  CollaborationStatus,
  type CampaignCollaborator,
  type CollaboratorRole,
} from '@ubuntu-fund/types';
import { CollaborationEntity } from '../../domain/entities/Collaboration.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { CollaborationRepositoryPort } from '../../domain/ports/outbound/CollaborationRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { toCollaboratorDto } from './mappers/collaborationDto.js';

export interface InviteCollaboratorRequest {
  campaignId: string;
  userEmail: string;
  role: CollaboratorRole;
  revenueSharePercent: number;
  inviteMessage?: string;
}

export class InviteCollaboratorUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly userRepo: UserRepositoryPort,
    private readonly collaborationRepo: CollaborationRepositoryPort
  ) {}

  async execute(
    input: InviteCollaboratorRequest,
    inviterId: string
  ): Promise<CampaignCollaborator> {
    const campaign = await this.campaignRepo.findById(input.campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }
    if (campaign.creatorId !== inviterId) {
      throw new AppError(
        'Only the campaign owner can invite collaborators',
        403
      );
    }

    const invitee = await this.userRepo.findByEmail(input.userEmail);
    if (!invitee) {
      throw new AppError('User not found', 404);
    }
    if (invitee.id === inviterId) {
      throw new AppError(
        'You cannot invite yourself as a collaborator',
        400
      );
    }

    const existing = await this.collaborationRepo.findByCampaignAndUser(
      input.campaignId,
      invitee.id
    );

    if (
      existing &&
      (existing.status === CollaborationStatus.PENDING ||
        existing.status === CollaborationStatus.ACCEPTED)
    ) {
      throw new AppError(
        'User is already a collaborator on this campaign',
        409
      );
    }

    if (existing) {
      existing.reinvite({
        invitedBy: inviterId,
        role: input.role,
        revenueSharePercent: input.revenueSharePercent,
        inviteMessage: input.inviteMessage,
      });
      const updated = await this.collaborationRepo.update(existing);
      return toCollaboratorDto(updated);
    }

    const now = new Date();
    const collaboration = new CollaborationEntity({
      id: '', // Assigned by the repository
      campaignId: input.campaignId,
      userId: invitee.id,
      invitedBy: inviterId,
      role: input.role,
      status: CollaborationStatus.PENDING,
      revenueSharePercent: input.revenueSharePercent,
      displayName: invitee.name,
      logoUrl: invitee.avatarUrl,
      inviteMessage: input.inviteMessage,
      createdAt: now,
      updatedAt: now,
    });

    const saved = await this.collaborationRepo.save(collaboration);
    return toCollaboratorDto(saved);
  }
}
