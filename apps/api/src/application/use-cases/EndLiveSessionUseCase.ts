import type { LiveSession } from '@ubuntu-fund/types';
import type { LiveSessionRepositoryPort } from '../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import { toLiveSessionDto } from './mappers/liveSessionDto.js';
import { loadOwnedSession } from './liveSessionAccess.js';
import type { LiveSessionRequester } from './StartLiveSessionUseCase.js';

/**
 * Ends a broadcast durably, then releases the video provider (revoke the
 * host, delete the room), retrying provider failures in the background.
 */
export interface LiveBroadcastEnder {
  /** Returns false when the session was no longer active. */
  end(sessionId: string): Promise<boolean>;
}

/**
 * End a live session (owner or admin only). Idempotent — ending an already
 * ended session simply returns it.
 *
 * The session is marked ended BEFORE any provider call, so no new video token
 * can be issued (and no room recreated) from that moment. A provider outage
 * no longer leaves the broadcast running with a 502: the session is ended and
 * the host revocation/room deletion is retried by the live reconcile loop.
 */
export class EndLiveSessionUseCase {
  constructor(
    private readonly liveSessionRepo: LiveSessionRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly broadcasts?: LiveBroadcastEnder
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

    if (!this.broadcasts) {
      session.end();
      return toLiveSessionDto(await this.liveSessionRepo.update(session));
    }
    await this.broadcasts.end(session.id);
    const ended = await this.liveSessionRepo.findById(session.id);
    return toLiveSessionDto(ended ?? session);
  }
}
