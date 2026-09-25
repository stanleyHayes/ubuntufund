import type { PublicProfileVisibilityPort } from '../../domain/ports/outbound/PublicProfileVisibilityPort.js';
import type { LiveOverlayView, LiveOverlayDonor } from '@ubuntu-fund/types';
import type { LiveSessionRepositoryPort } from '../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { LiveSessionEntity } from '../../domain/entities/LiveSession.js';
import { GUEST_DONOR_ID, type DonationEntity } from '../../domain/entities/Donation.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { overlayTokenMatches } from '../utils/overlayToken.js';

/** How many recent donors the overlay renders. */
const RECENT_DONORS_LIMIT = 10;

/**
 * Build the overlay payload for a live session. Requires the session's overlay
 * token. Returns the host-configured privacy view: session + campaign totals
 * and a privacy-filtered list of the most recent donors. Throws 404 for an
 * unknown session and 403 for a bad/missing token.
 */
export class GetLiveSessionOverlayUseCase {
  constructor(
    private readonly liveSessionRepo: LiveSessionRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly donationRepo: DonationRepositoryPort,
    private readonly userRepo: UserRepositoryPort,
    private readonly visibility: PublicProfileVisibilityPort
  ) {}

  async execute(sessionId: string, token: string | undefined, viewerId?: string): Promise<LiveOverlayView> {
    const session = await this.liveSessionRepo.findById(sessionId);
    if (!session) {
      throw new AppError('Live session not found', 404);
    }
    if (!overlayTokenMatches(session.overlayToken, token)) {
      throw new AppError('Invalid overlay token', 403);
    }

    const campaign = await this.campaignRepo.findById(session.campaignId);
    if (!campaign) {
      throw new AppError('Live session not found', 404);
    }

    const amountsVisible = session.amountsVisible();

    const donations = await this.donationRepo.findByCampaignId(session.campaignId);
    const recent = [...donations]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, RECENT_DONORS_LIMIT);
    const hidden = await this.visibility.hiddenContentAuthorIds(recent.map(donation => donation.donorId).filter(id => id !== GUEST_DONOR_ID), viewerId);
    const recentDonors = await Promise.all(
      recent.map((donation) => this.toOverlayDonor(donation, session, hidden.has(donation.donorId)))
    );

    return {
      sessionId: session.id,
      campaignId: session.campaignId,
      title: session.title,
      targetAmount: session.targetAmount,
      status: session.status,
      config: {
        showDonorNames: session.showDonorNames,
        showDonorMessages: session.showDonorMessages,
        showAmounts: session.showAmounts,
        privacyMode: session.privacyMode,
      },
      totals: {
        amountRaised: amountsVisible ? session.stats.amountRaised : null,
        successfulDonations: session.stats.successfulDonations,
        scans: session.stats.scans,
        checkoutStarts: session.stats.checkoutStarts,
      },
      campaignRaisedAmount: campaign.raisedAmount.amount,
      campaignGoalAmount: campaign.goalAmount.amount,
      currency: campaign.goalAmount.currency,
      recentDonors,
    };
  }

  private async toOverlayDonor(
    donation: DonationEntity,
    session: LiveSessionEntity,
    hidden: boolean
  ): Promise<LiveOverlayDonor> {
    const name = !hidden && session.namesVisible() ? donation.publicDonorName ?? 'Anonymous' : 'Anonymous';

    return {
      donationId: donation.id,
      name,
      amount: session.amountsVisible() ? donation.amount.amount : null,
      message: !hidden && session.messagesVisible() ? donation.publicMessage : undefined,
      createdAt: donation.createdAt,
    };
  }
}
