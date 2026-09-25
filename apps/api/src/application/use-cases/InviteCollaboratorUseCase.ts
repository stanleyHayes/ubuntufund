import {
  CollaborationStatus,
  type CampaignCollaborator,
  type CollaboratorRole,
} from '@ubuntu-fund/types';
import { CollaborationEntity } from '../../domain/entities/Collaboration.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { CollaborationRepositoryPort } from '../../domain/ports/outbound/CollaborationRepositoryPort.js';
import type { PlanLimitsService } from '../services/PlanLimitsService.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { toCollaboratorDto } from './mappers/collaborationDto.js';
import type { NotificationRepositoryPort } from '../../domain/ports/outbound/NotificationRepositoryPort.js';
import { NotificationEntity } from '../../domain/entities/Notification.js';
import { logger } from '../../infrastructure/logging/logger.js';

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
    private readonly collaborationRepo: CollaborationRepositoryPort,
    private readonly planLimits: PlanLimitsService,
    private readonly notifications?: Pick<NotificationRepositoryPort, 'save'>
  ) {}

  /**
   * Returns the invitation, or null when the email has no account: the owner
   * gets the same generic success either way instead of "User not found",
   * which confirmed whether any email is registered.
   */
  async execute(
    input: InviteCollaboratorRequest,
    inviterId: string
  ): Promise<CampaignCollaborator | null> {
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

    // Collaboration is a plan feature; the per-campaign collaborator count is
    // also plan-capped. Both follow the campaign owner's plan.
    const plan = await this.planLimits.resolvePlan(campaign.creatorId);
    if (!plan.campaignCollaboration) {
      throw new AppError(
        `Your ${plan.name} plan does not include campaign collaboration. Upgrade to invite collaborators.`,
        403
      );
    }

    if (input.revenueSharePercent > 0) {
      await this.planLimits.assertFeature(campaign.creatorId, 'escrowSupport', 'shared proceeds');
    }

    const invitee = await this.userRepo.findByEmail(input.userEmail);
    if (!invitee) return null;
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

    // Cap the number of active (pending or accepted) collaborators per the
    // owner's plan. -1 means unlimited. The record being (re)invited here is
    // declined/removed, so it is not among the active ones counted below.
    if (plan.maxCollaboratorsPerCampaign >= 0) {
      const activeCount = (
        await this.collaborationRepo.findByCampaignId(input.campaignId)
      ).filter(
        (c) =>
          c.status === CollaborationStatus.PENDING ||
          c.status === CollaborationStatus.ACCEPTED
      ).length;
      if (activeCount >= plan.maxCollaboratorsPerCampaign) {
        throw new AppError(
          `Your ${plan.name} plan allows ${plan.maxCollaboratorsPerCampaign} collaborator(s) per campaign. Upgrade to add more.`,
          403
        );
      }
    }

    if (existing) {
      existing.reinvite({
        invitedBy: inviterId,
        role: input.role,
        revenueSharePercent: input.revenueSharePercent,
        inviteMessage: input.inviteMessage,
      });
      const updated = await this.collaborationRepo.update(existing);
      await this.notifyInvitee(invitee.id, campaign.title);
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
    await this.notifyInvitee(invitee.id, campaign.title);
    return toCollaboratorDto(saved);
  }

  /** In-app notice so the invitee learns of it without opening Invitations. Best-effort. */
  private async notifyInvitee(userId: string, campaignTitle: string): Promise<void> {
    if (!this.notifications) return;
    try {
      await this.notifications.save(new NotificationEntity({
        id: '', userId, type: 'collaboration_invitation', read: false, createdAt: new Date(),
        title: 'Campaign invitation',
        body: `You were invited to be listed as a collaborator on "${campaignTitle}". Review it in Invitations.`,
        path: '/invitations',
      }));
    } catch (error) {
      logger.warn({ err: error, userId }, 'Collaboration invitation notification failed');
    }
  }
}
