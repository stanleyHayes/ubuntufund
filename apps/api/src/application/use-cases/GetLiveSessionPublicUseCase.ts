import type { LiveSessionPublicView } from '@ubuntu-fund/types';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { LiveSessionRepositoryPort } from '../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import { toLiveSessionPublicView } from './mappers/liveSessionDto.js';

/**
 * Public donor-facing sheet for a live session. No token required; the mapper
 * strips the overlay token and honors the host's amount-visibility choice.
 * Returns null when the session is unknown. A broadcast whose campaign can no
 * longer take donations (closed or past its end date) reads as ended, even
 * before the stale-session sweep records it, so viewers are not shown a LIVE
 * player that cannot connect.
 */
export class GetLiveSessionPublicUseCase {
  constructor(private readonly liveSessionRepo: LiveSessionRepositoryPort, private readonly campaignRepo?: CampaignRepositoryPort) {}

  async execute(sessionId: string): Promise<LiveSessionPublicView | null> {
    const session = await this.liveSessionRepo.findById(sessionId);
    if (!session) return null;
    const campaign = await this.campaignRepo?.findById(session.campaignId);
    const view = toLiveSessionPublicView(session);
    const closed = !!this.campaignRepo && (!campaign || !campaign.canReceiveDonation());
    return { ...view, status: closed ? 'ended' : view.status, creatorId: campaign?.creatorId, currency: campaign?.goalAmount.currency ?? 'GHS' };
  }
}
