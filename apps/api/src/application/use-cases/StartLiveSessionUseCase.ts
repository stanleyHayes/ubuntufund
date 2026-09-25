import type { LiveSessionCreationPort } from '../../domain/ports/outbound/LiveSessionCreationPort.js';
import type { PublicationAdmissionPort, PublicationSubmission } from '../../domain/ports/outbound/PublicationAdmissionPort.js';
import type { LiveSession, StartLiveSessionInput } from '@ubuntu-fund/types';
import { LiveSessionEntity } from '../../domain/entities/LiveSession.js';
import type { LiveSessionRepositoryPort } from '../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { PlanLimitsService } from '../services/PlanLimitsService.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { generateOverlayToken } from '../utils/overlayToken.js';
import { toLiveSessionDto } from './mappers/liveSessionDto.js';

export interface LiveSessionRequester {
  userId: string;
  role?: string;
  authVersion?: string;
}

/**
 * Start a live fundraising session for a campaign (owner or admin only). Mints
 * a fresh overlay token and returns the full owner DTO (token included).
 */
export class StartLiveSessionUseCase {
  constructor(
    private readonly liveSessionRepo: LiveSessionRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly planLimits: PlanLimitsService,
    private readonly admission?: PublicationAdmissionPort,
    private readonly creation?: LiveSessionCreationPort
  ) {}

  async execute(
    campaignId: string,
    input: StartLiveSessionInput,
    requester: LiveSessionRequester
  ): Promise<LiveSession> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const isOwner = campaign.creatorId === requester.userId;
    const isAdmin = requester.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new AppError(
        'Only the campaign owner can start a live session',
        403
      );
    }

    if (!campaign.canReceiveDonation()) throw new AppError('Only an active campaign can go live', 409);

    // LIVE fundraising is a plan feature, gated against the campaign owner's
    // plan (not the requester's — an admin starting on the owner's behalf still
    // uses the owner's entitlement). Checked before resuming an existing
    // session too, so a lapsed plan cannot keep re-entering an old broadcast.
    await this.planLimits.assertFeature(
      campaign.creatorId,
      'liveStreaming',
      'LIVE streaming'
    );

    const existing = await this.liveSessionRepo.findActiveByCampaignId(campaign.id);
    if (existing) return toLiveSessionDto(existing);

    if (input.targetAmount != null && input.targetAmount <= 0) {
      throw new AppError('targetAmount must be a positive number', 400);
    }

    if (!this.admission) throw new AppError('Publication review is unavailable', 503);
    const submission: PublicationSubmission = {
      actorId: requester.userId, action: 'live.start', resourceId: campaign.id,
      text: JSON.stringify([input.title ?? '', input.targetAmount ?? null]),
      mediaUrls: [], automatedReviewConsent: input.automatedReviewConsent,
    };
    await this.admission.assertAllowed(submission);
    // Screening may involve a staff-held retry or provider delay. Recheck the
    // campaign before creating a session; no overlay token is minted on a hold.
    const current = await this.campaignRepo.findById(campaign.id);
    if (!current || !current.canReceiveDonation() || current.creatorId !== campaign.creatorId) {
      throw new AppError('The campaign is no longer available to go live', 409);
    }

    const session = new LiveSessionEntity({
      id: '', // assigned by the repository
      campaignId: campaign.id,
      title: input.title,
      targetAmount: input.targetAmount,
      status: 'active',
      overlayToken: generateOverlayToken(),
      showDonorNames: input.showDonorNames ?? true,
      showDonorMessages: input.showDonorMessages ?? true,
      showAmounts: input.showAmounts ?? true,
      privacyMode: input.privacyMode ?? false,
      startedAt: new Date(),
      stats: {
        scans: 0,
        checkoutStarts: 0,
        successfulDonations: 0,
        amountRaised: 0,
      },
    });

    try {
      if (!this.creation || !this.admission.assertCurrent) throw new AppError('Live publication verification is unavailable', 503);
      return await this.creation.run(campaign.id, campaign.creatorId, requester.userId, requester.authVersion ?? '', async () => {
        await this.admission!.assertCurrent!(submission);
        await this.planLimits.assertFeature(campaign.creatorId, 'liveStreaming', 'LIVE streaming', true);
        const concurrent = await this.liveSessionRepo.findActiveByCampaignId(campaign.id);
        if (concurrent) return toLiveSessionDto(concurrent);
        return toLiveSessionDto(await this.liveSessionRepo.save(session));
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const concurrent = await this.liveSessionRepo.findActiveByCampaignId(campaign.id);
        if (concurrent) return toLiveSessionDto(concurrent);
      }
      throw error;
    }
  }
}
