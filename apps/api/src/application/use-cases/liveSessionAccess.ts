import type { LiveSessionRepositoryPort } from '../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { LiveSessionEntity } from '../../domain/entities/LiveSession.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import type { LiveSessionRequester } from './StartLiveSessionUseCase.js';

/**
 * Load a live session and assert the requester owns its campaign (or is an
 * admin). Shared by the end / privacy / rotate use cases. Throws 404 when the
 * session (or its campaign) is missing, 403 when the requester is not the
 * owner.
 */
export async function loadOwnedSession(
  liveSessionRepo: LiveSessionRepositoryPort,
  campaignRepo: CampaignRepositoryPort,
  sessionId: string,
  requester: LiveSessionRequester
): Promise<LiveSessionEntity> {
  const session = await liveSessionRepo.findById(sessionId);
  if (!session) {
    throw new AppError('Live session not found', 404);
  }

  const campaign = await campaignRepo.findById(session.campaignId);
  if (!campaign) {
    throw new AppError('Live session not found', 404);
  }

  const isOwner = campaign.creatorId === requester.userId;
  const isAdmin = requester.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw new AppError('Only the campaign owner can manage this live session', 403);
  }

  return session;
}
