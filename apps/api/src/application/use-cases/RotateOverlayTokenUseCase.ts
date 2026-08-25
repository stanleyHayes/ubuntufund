import type { LiveSession } from '@ubuntu-fund/types';
import type { LiveSessionRepositoryPort } from '../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import { generateOverlayToken } from '../utils/overlayToken.js';
import { toLiveSessionDto } from './mappers/liveSessionDto.js';
import { loadOwnedSession } from './liveSessionAccess.js';
import type { LiveSessionRequester } from './StartLiveSessionUseCase.js';

/**
 * Rotate a live session's overlay token (owner or admin only), instantly
 * revoking every overlay/SSE client still using the old value. Returns the
 * session with its new token.
 */
export class RotateOverlayTokenUseCase {
  constructor(
    private readonly liveSessionRepo: LiveSessionRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort
  ) {}

  async execute(
    sessionId: string,
    requester: LiveSessionRequester
  ): Promise<LiveSession> {
    const session = await loadOwnedSession(
      this.liveSessionRepo,
      this.campaignRepo,
      sessionId,
      requester
    );

    session.rotateOverlayToken(generateOverlayToken());
    const updated = await this.liveSessionRepo.update(session);
    return toLiveSessionDto(updated);
  }
}
