import type { LiveSessionRepositoryPort } from '../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { LiveSessionRequester } from './StartLiveSessionUseCase.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { toLiveSessionDto, toLiveSessionPublicView } from './mappers/liveSessionDto.js';

/** Recover owner controls from the server, including across devices. */
export class GetActiveLiveSessionUseCase {
  constructor(private readonly sessions: LiveSessionRepositoryPort, private readonly campaigns: CampaignRepositoryPort) {}
  async publicView(campaignId: string) {
    const campaign = await this.campaigns.findById(campaignId);
    if (!campaign || !campaign.canReceiveDonation()) return null;
    const session = await this.sessions.findActiveByCampaignId(campaignId);
    return session ? toLiveSessionPublicView(session) : null;
  }
  async execute(campaignId: string, requester: LiveSessionRequester) {
    const campaign = await this.campaigns.findById(campaignId);
    if (!campaign) throw new AppError('Campaign not found', 404);
    if (campaign.creatorId !== requester.userId && requester.role !== 'admin') throw new AppError('Only the campaign owner can view live controls', 403);
    const session = await this.sessions.findActiveByCampaignId(campaignId);
    return session ? toLiveSessionDto(session) : null;
  }
}
