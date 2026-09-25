import { isDonationContentApproved } from '../../../../../domain/entities/donationPublicContent.js';
import type { PublicProfileVisibilityPort } from '../../../../../domain/ports/outbound/PublicProfileVisibilityPort.js';
import type { UserRepositoryPort } from '../../../../../domain/ports/outbound/UserRepositoryPort.js';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { GUEST_DONOR_ID } from '../../../../../domain/entities/Donation.js';
import { isPublicCampaign } from '../../../../../domain/services/campaignVisibility.js';
import { DonationModel } from '../../../../database/models/DonationModel.js';
import type { Request, Response, NextFunction } from 'express';
import type { LiveSessionEntity } from '../../../../../domain/entities/LiveSession.js';
import type { CampaignRepositoryPort } from '../../../../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { LiveSessionRepositoryPort } from '../../../../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import {
  EventBus,
  type BusEvent,
  campaignChannel,
  liveChannel,
} from '../../../../realtime/EventBus.js';
import { AppError } from '../../middleware/errorHandler.js';
import { overlayTokenMatches } from '../../../../../application/utils/overlayToken.js';

/** Comment heartbeat cadence — keeps proxies from idling the connection out. */
const HEARTBEAT_MS = 20_000;

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

/** Resolve the resume point from the `Last-Event-ID` header or query param. */
function parseLastEventId(req: Request): number | undefined {
  const raw =
    (req.headers['last-event-id'] as string | undefined) ??
    firstQueryValue(req.query.lastEventId);
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function writeSseEvent(res: Response, event: BusEvent): void {
  res.write(`id: ${event.id}\n`);
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event.data)}\n\n`);
}

/**
 * Server-Sent Events gateway for live-session real-time feeds. Two surfaces:
 *   GET /campaigns/:id/events          — PUBLIC whole-campaign feed
 *   GET /live-sessions/:id/events?token=… — overlay-token-gated session feed
 *
 * Each connection replays any events missed since `Last-Event-ID` from the
 * bus's ring buffer, then streams live events, with a comment heartbeat every
 * ~20s. Listeners are torn down on client disconnect.
 *
 * Privacy is applied upstream at publish time (see RealtimeDonationProjector):
 * campaign-channel events carry public data; session-channel events honor the
 * host's overlay toggles. The gateway rechecks current message/anonymity state
 * before delivery, including buffered replay.
 */
export class RealtimeController {
  constructor(
    private readonly eventBus: EventBus,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly liveSessionRepo: LiveSessionRepositoryPort,
    private readonly users: UserRepositoryPort,
    private readonly visibility: PublicProfileVisibilityPort
  ) {}

  /** GET /campaigns/:id/events — public campaign SSE feed. */
  campaignEvents = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const campaignId = req.params.id as string;
      const campaign = await this.campaignRepo.findById(campaignId);
      if (!campaign || !isPublicCampaign(campaign.status) || (await this.visibility.hiddenContentAuthorIds([campaign.creatorId], req.userId)).has(campaign.creatorId)) {
        throw new AppError('Campaign not found', 404);
      }
      this.stream(req, res, campaignChannel(campaignId), campaignId, undefined, async () => {
        const current = await this.campaignRepo.findById(campaignId);
        return !!current && isPublicCampaign(current.status) && !(await this.visibility.hiddenContentAuthorIds([current.creatorId], req.userId)).has(current.creatorId);
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /live-sessions/:id/events?token=… — overlay-token-gated session feed. */
  liveSessionEvents = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const sessionId = req.params.id as string;
      const token = firstQueryValue(req.query.token);
      const session = await this.liveSessionRepo.findById(sessionId);
      if (!session) {
        throw new AppError('Live session not found', 404);
      }
      if (!overlayTokenMatches(session.overlayToken, token)) {
        throw new AppError('Invalid overlay token', 403);
      }
      if (!session.isActive()) throw new AppError('This live session has ended', 409);
      const campaign = await this.campaignRepo.findById(session.campaignId);
      if (!campaign || !isPublicCampaign(campaign.status) || (await this.visibility.hiddenContentAuthorIds([campaign.creatorId], req.userId)).has(campaign.creatorId)) throw new AppError('Campaign not found', 404);
      this.stream(req, res, liveChannel(sessionId), session.campaignId, async () => {
        const current = await this.liveSessionRepo.findById(sessionId);
        return current?.isActive() && overlayTokenMatches(current.overlayToken, token) ? current : null;
      }, async () => {
        const current = await this.campaignRepo.findById(session.campaignId);
        return !!current && isPublicCampaign(current.status) && !(await this.visibility.hiddenContentAuthorIds([current.creatorId], req.userId)).has(current.creatorId);
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Open the SSE stream on `channel`: set the event-stream headers, replay
   * buffered events after `Last-Event-ID`, subscribe for live events, start the
   * heartbeat, and clean everything up when the client disconnects.
   */
  private stream(req: AuthenticatedRequest, res: Response, channel: string, campaignId: string, sessionGuard?: () => Promise<LiveSessionEntity | null>, publicationGuard?: () => Promise<boolean>): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'private, no-store, no-transform',
      Connection: 'keep-alive',
      // Disable proxy buffering (nginx) so events flush immediately.
      'X-Accel-Buffering': 'no',
    });
    // Advise clients to wait 3s before reconnecting after a drop.
    res.write('retry: 3000\n\n');

    let closed = false;
    let queue = Promise.resolve();
    const deliver = (event: BusEvent) => {
      queue = queue.then(async () => {
        if (closed) return;
        if (publicationGuard && !(await publicationGuard())) { finish(); return; }
        let data = { ...(event.data as Record<string, unknown>) };
        if (event.type === 'donation') {
          const id = typeof data.donationId === 'string' ? data.donationId : '';
          const current = /^[a-f0-9]{24}$/i.test(id) ? await DonationModel.findOne({ _id: id, campaignId }).lean() : null;
          // An event is a notification, not authority for donation ownership or identity.
          if (!current) return;
          const hidden = current.donorId !== GUEST_DONOR_ID && (await this.visibility.hiddenContentAuthorIds([current.donorId], req.userId)).has(current.donorId);
          let name = 'Anonymous';
          if (!hidden && !current.isAnonymous && isDonationContentApproved(current)) {
            name = current.donorName || (current.donorId === GUEST_DONOR_ID ? 'Guest donor' : 'Supporter');
          }
          data = {
            donationId: String(current._id), name, amount: current.amount,
            createdAt: current.createdAt.toISOString(),
            ...(!hidden && isDonationContentApproved(current) && !current.messageHiddenAt && current.message ? { message: current.message } : {}),
          };
        }
        if (!sessionGuard) { if (!closed) writeSseEvent(res, { ...event, data }); return; }
        const session = await sessionGuard();
        if (!session) { finish(); return; }
        if (event.type === 'donation') {
          if (!session.namesVisible()) data.name = 'Anonymous';
          if (!session.messagesVisible()) delete data.message;
          if (!session.amountsVisible()) data.amount = null;
        }
        if (!session.amountsVisible()) {
          if ('sessionAmountRaised' in data) data.sessionAmountRaised = null;
          if (event.type === 'milestone') data.raisedAmount = null;
        }
        if (!closed) writeSseEvent(res, { ...event, data });
      }).catch(() => finish());
    };
    const lastEventId = parseLastEventId(req);
    for (const event of this.eventBus.getBufferedEvents(channel, lastEventId)) deliver(event);
    const unsubscribe = this.eventBus.subscribe(channel, deliver);
    const heartbeat = setInterval(() => {
      queue = queue.then(async () => {
        if (closed) return;
        if (publicationGuard && !(await publicationGuard())) { finish(); return; }
        if (sessionGuard && !(await sessionGuard())) { finish(); return; }
        if (!closed) res.write(`: heartbeat ${Date.now()}\n\n`);
      }).catch(() => finish());
    }, HEARTBEAT_MS);
    function finish() {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    }
    req.on('close', finish);
  }
}
