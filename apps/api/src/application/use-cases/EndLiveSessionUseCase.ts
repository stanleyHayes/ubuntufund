import type { LiveSession } from '@ubuntu-fund/types';
import type { LiveSessionRepositoryPort } from '../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import { toLiveSessionDto } from './mappers/liveSessionDto.js';
import { loadOwnedSession } from './liveSessionAccess.js';
import type { LiveSessionRequester } from './StartLiveSessionUseCase.js';

/**
 * End a live session (owner or admin only). Idempotent — ending an already
 * ended session simply returns it.
 */
export class EndLiveSessionUseCase {
  constructor(
    private readonly liveSessionRepo: LiveSessionRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly video?: { closeRoom(id: string): Promise<void> }
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

    if (!session.isActive()) {
      return toLiveSessionDto(session);
    }

    await this.video?.closeRoom(session.id);
    session.end();
    const updated = await this.liveSessionRepo.update(session);
    return toLiveSessionDto(updated);
  }
}
