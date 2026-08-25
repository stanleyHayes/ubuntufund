import type { Request, Response, NextFunction } from 'express';
import type { CampaignRepositoryPort } from '../../../../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { LiveSessionRepositoryPort } from '../../../../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import {
  EventBus,
  type BusEvent,
  campaignChannel,
  liveChannel,
} from '../../../../realtime/EventBus.js';
import { AppError } from '../../middleware/errorHandler.js';

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
 * host's overlay toggles. The gateway forwards them verbatim.
 */
export class RealtimeController {
  constructor(
    private readonly eventBus: EventBus,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly liveSessionRepo: LiveSessionRepositoryPort
  ) {}

  /** GET /campaigns/:id/events — public campaign SSE feed. */
  campaignEvents = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const campaignId = req.params.id as string;
      const campaign = await this.campaignRepo.findById(campaignId);
      if (!campaign) {
        throw new AppError('Campaign not found', 404);
      }
      this.stream(req, res, campaignChannel(campaignId));
    } catch (error) {
      next(error);
    }
  };

  /** GET /live-sessions/:id/events?token=… — overlay-token-gated session feed. */
  liveSessionEvents = async (
    req: Request,
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
      if (!token || token !== session.overlayToken) {
        throw new AppError('Invalid overlay token', 403);
      }
      this.stream(req, res, liveChannel(sessionId));
    } catch (error) {
      next(error);
    }
  };

  /**
   * Open the SSE stream on `channel`: set the event-stream headers, replay
   * buffered events after `Last-Event-ID`, subscribe for live events, start the
   * heartbeat, and clean everything up when the client disconnects.
   */
  private stream(req: Request, res: Response, channel: string): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disable proxy buffering (nginx) so events flush immediately.
      'X-Accel-Buffering': 'no',
    });
    // Advise clients to wait 3s before reconnecting after a drop.
    res.write('retry: 3000\n\n');

    // Replay anything missed since the client's last seen id.
    const lastEventId = parseLastEventId(req);
    for (const event of this.eventBus.getBufferedEvents(channel, lastEventId)) {
      writeSseEvent(res, event);
    }

    const unsubscribe = this.eventBus.subscribe(channel, (event) => {
      writeSseEvent(res, event);
    });

    const heartbeat = setInterval(() => {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    }, HEARTBEAT_MS);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  }
}
