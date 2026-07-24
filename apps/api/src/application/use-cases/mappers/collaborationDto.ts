import type { CampaignCollaborator } from '@ubuntu-fund/types';
import type { CollaborationEntity } from '../../../domain/entities/Collaboration.js';

/** Shared mapper from the domain entity to the wire-format DTO used by every
 * collaboration use case's response. */
export function toCollaboratorDto(
  entity: CollaborationEntity
): CampaignCollaborator {
  const plain = entity.toPlain();
  return {
    id: plain.id,
    campaignId: plain.campaignId,
    userId: plain.userId,
    invitedBy: plain.invitedBy,
    role: plain.role,
    status: plain.status,
    revenueSharePercent: plain.revenueSharePercent,
    displayName: plain.displayName,
    logoUrl: plain.logoUrl,
    inviteMessage: plain.inviteMessage,
    respondedAt: plain.respondedAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}
