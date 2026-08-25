import type {
  LiveDonationEventData,
  LiveTotalEventData,
  LiveMilestoneEventData,
} from '@ubuntu-fund/types';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { LiveSessionRepositoryPort } from '../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { LiveSessionEntity } from '../../domain/entities/LiveSession.js';
import {
  EventBus,
  campaignChannel,
  liveChannel,
} from '../../infrastructure/realtime/EventBus.js';
import { logger } from '../../infrastructure/logging/logger.js';

/** Goal thresholds (percent) that fire a `milestone` event when crossed. */
const MILESTONES = [25, 50, 75, 100];

/**
 * The percentage thresholds newly crossed by moving the raised total from
 * `previous` to `next` against `goal`. 100% fires on reaching/exceeding goal.
 */
function crossedMilestones(previous: number, next: number, goal: number): number[] {
  if (goal <= 0) return [];
  const previousPct = (previous / goal) * 100;
  const nextPct = (next / goal) * 100;
  return MILESTONES.filter((m) => previousPct < m && nextPct >= m);
}

/** The donation facts a successful donation hands to the realtime projector. */
export interface DonationRealtimeInput {
  donationId: string;
  donorId: string;
  /**
   * Pre-resolved donor display name. Supplied for guest checkouts (no user
   * record to look up); when absent the name is resolved from `donorId`.
   */
  donorName?: string;
  amount: number;
  currency: string;
  message?: string;
  isAnonymous: boolean;
  createdAt: Date;
}

/**
 * Projects a successful donation onto the real-time event bus: publishes a
 * `donation` event, recomputed `total`s, and any crossed `milestone`s to both
 * the whole-campaign channel and (when the donation is attributed to a live
 * session) the session channel — and increments that session's stats.
 *
 * The campaign channel carries public-appropriate data (donor name honoring the
 * donation's own anonymity, amounts shown). The session channel honors the
 * host's overlay privacy toggles (hidden names → `Anonymous`, hidden amounts →
 * `null`).
 *
 * This is the single reusable seam the wallet rail (today) and the hosted
 * payment phases (later) both call after a donation settles. It never throws —
 * a realtime failure must never fail the donation that triggered it.
 */
export class RealtimeDonationProjector {
  constructor(
    private readonly eventBus: EventBus,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly liveSessionRepo: LiveSessionRepositoryPort,
    private readonly userRepo: UserRepositoryPort
  ) {}

  async recordDonationRealtime(
    campaignId: string,
    liveSessionId: string | undefined,
    donation: DonationRealtimeInput
  ): Promise<void> {
    try {
      const campaign = await this.campaignRepo.findById(campaignId);
      if (!campaign) return;

      const goalAmount = campaign.goalAmount.amount;
      const currency = campaign.goalAmount.currency;
      // `incrementRaised` has already run, so the campaign's raised total is the
      // post-donation figure; the pre-donation figure is that minus this gift.
      const raisedAmount = campaign.raisedAmount.amount;
      const previousRaised = Math.max(0, raisedAmount - donation.amount);
      const milestones = crossedMilestones(previousRaised, raisedAmount, goalAmount);

      const donorName = await this.resolveDonorName(donation);

      // Attribute to a live session (atomic stat bump) when one was supplied.
      let session: LiveSessionEntity | null = null;
      if (liveSessionId) {
        session = await this.liveSessionRepo.incrementStats(liveSessionId, {
          successfulDonations: 1,
          amountRaised: donation.amount,
        });
      }

      // ── Whole-campaign channel (public) ──────────────────────────────
      const campaignCh = campaignChannel(campaignId);

      this.eventBus.publish(campaignCh, 'donation', {
        donationId: donation.donationId,
        name: donation.isAnonymous ? 'Anonymous' : donorName,
        amount: donation.amount,
        message: donation.message,
        createdAt: donation.createdAt.toISOString(),
      } satisfies LiveDonationEventData);

      this.eventBus.publish(campaignCh, 'total', {
        campaignId,
        raisedAmount,
        goalAmount,
        currency,
        liveSessionId,
        sessionAmountRaised: session ? session.stats.amountRaised : undefined,
      } satisfies LiveTotalEventData);

      for (const percent of milestones) {
        this.eventBus.publish(campaignCh, 'milestone', {
          campaignId,
          percent,
          raisedAmount,
          goalAmount,
          currency,
          liveSessionId,
        } satisfies LiveMilestoneEventData);
      }

      // ── Session channel (host-configured privacy) ────────────────────
      if (session) {
        const liveCh = liveChannel(session.id);
        const amountsVisible = session.amountsVisible();

        this.eventBus.publish(liveCh, 'donation', {
          donationId: donation.donationId,
          name:
            !donation.isAnonymous && session.namesVisible()
              ? donorName
              : 'Anonymous',
          amount: amountsVisible ? donation.amount : null,
          message: session.messagesVisible() ? donation.message : undefined,
          createdAt: donation.createdAt.toISOString(),
        } satisfies LiveDonationEventData);

        this.eventBus.publish(liveCh, 'total', {
          campaignId,
          raisedAmount,
          goalAmount,
          currency,
          liveSessionId: session.id,
          sessionAmountRaised: amountsVisible ? session.stats.amountRaised : null,
        } satisfies LiveTotalEventData);

        for (const percent of milestones) {
          this.eventBus.publish(liveCh, 'milestone', {
            campaignId,
            percent,
            raisedAmount: amountsVisible ? raisedAmount : null,
            goalAmount,
            currency,
            liveSessionId: session.id,
          } satisfies LiveMilestoneEventData);
        }
      }
    } catch (error) {
      logger.error(
        { err: error, campaignId, liveSessionId },
        'failed to project donation realtime events'
      );
    }
  }

  private async resolveDonorName(
    donation: DonationRealtimeInput
  ): Promise<string> {
    if (donation.isAnonymous) return 'Anonymous';
    // Guests carry no user record — trust the pre-resolved name they supplied.
    if (donation.donorName) return donation.donorName;
    const user = await this.userRepo.findById(donation.donorId);
    return user?.name ?? 'Anonymous';
  }
}
