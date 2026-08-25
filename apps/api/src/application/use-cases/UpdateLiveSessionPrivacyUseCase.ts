import type { LiveSession, UpdateLiveSessionInput } from '@ubuntu-fund/types';
import type { LiveSessionRepositoryPort } from '../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import { toLiveSessionDto } from './mappers/liveSessionDto.js';
import { loadOwnedSession } from './liveSessionAccess.js';
import type { LiveSessionRequester } from './StartLiveSessionUseCase.js';

/**
 * Toggle a live session's donor-visibility flags and privacy mode (owner or
 * admin only). New settings take effect immediately for subsequent events.
 */
export class UpdateLiveSessionPrivacyUseCase {
  constructor(
    private readonly liveSessionRepo: LiveSessionRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort
  ) {}

  async execute(
    sessionId: string,
    input: UpdateLiveSessionInput,
    requester: LiveSessionRequester
  ): Promise<LiveSession> {
    const session = await loadOwnedSession(
      this.liveSessionRepo,
      this.campaignRepo,
      sessionId,
      requester
    );

    session.updatePrivacy({
      showDonorNames: input.showDonorNames,
      showDonorMessages: input.showDonorMessages,
      showAmounts: input.showAmounts,
      privacyMode: input.privacyMode,
    });

    const updated = await this.liveSessionRepo.update(session);
    return toLiveSessionDto(updated);
  }
}
