import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { GetActiveLiveSessionUseCase } from '../../../../../application/use-cases/GetActiveLiveSessionUseCase.js';
import type { StartLiveSessionUseCase } from '../../../../../application/use-cases/StartLiveSessionUseCase.js';
import type { EndLiveSessionUseCase } from '../../../../../application/use-cases/EndLiveSessionUseCase.js';
import type { UpdateLiveSessionPrivacyUseCase } from '../../../../../application/use-cases/UpdateLiveSessionPrivacyUseCase.js';
import type { RotateOverlayTokenUseCase } from '../../../../../application/use-cases/RotateOverlayTokenUseCase.js';
import type { GetLiveSessionPublicUseCase } from '../../../../../application/use-cases/GetLiveSessionPublicUseCase.js';
import type { GetLiveSessionOverlayUseCase } from '../../../../../application/use-cases/GetLiveSessionOverlayUseCase.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { LiveVideoService } from '../../../outbound/video/LiveVideoService.js';
import { config } from '../../../../config/index.js';
import { OVERLAY_PAGE_HTML } from '../views/overlayPage.js';

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

export class LiveSessionController {
  constructor(
    private readonly startLiveSessionUseCase: StartLiveSessionUseCase,
    private readonly endLiveSessionUseCase: EndLiveSessionUseCase,
    private readonly updateLiveSessionPrivacyUseCase: UpdateLiveSessionPrivacyUseCase,
    private readonly rotateOverlayTokenUseCase: RotateOverlayTokenUseCase,
    private readonly getLiveSessionPublicUseCase: GetLiveSessionPublicUseCase,
    private readonly getLiveSessionOverlayUseCase: GetLiveSessionOverlayUseCase,
    private readonly getActiveLiveSessionUseCase: GetActiveLiveSessionUseCase,
    private readonly video: LiveVideoService
  ) {}

  videoConfig = (_req: Request, res: Response) => { res.json({ data: { enabled: this.video.enabled } }); };
  hostVideoToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try { res.set('Cache-Control', 'no-store').json({ data: await this.video.join(req.params.id as string, req.userId!) }); } catch (error) { next(error); }
  };
  viewerVideoToken = async (req: Request, res: Response, next: NextFunction) => {
    try { res.set('Cache-Control', 'no-store').json({ data: await this.video.join(req.params.id as string) }); } catch (error) { next(error); }
  };

  getPublicActive = async (req: Request, res: Response, next: NextFunction) => {
    try { res.set('Cache-Control', 'no-store').json({ data: await this.getActiveLiveSessionUseCase.publicView(req.params.id as string) }); } catch (error) { next(error); }
  };
  getActive = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.getActiveLiveSessionUseCase.execute(req.params.id as string, { userId: req.userId!, role: req.userRole });
      res.set('Cache-Control', 'no-store').json({ data });
    } catch (error) { next(error); }
  };

  /** POST /campaigns/:id/live-sessions — start a session (owner/admin). */
  start = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const session = await this.startLiveSessionUseCase.execute(
        req.params.id as string,
        req.body,
        { userId: req.userId!, role: req.userRole }
      );
      res.status(201).json({
        data: session,
        message: 'Live session started',
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /live-sessions/:id — end the session (`{ status: 'ended' }`) or update
   * its privacy toggles (owner/admin). Ending takes precedence when both are
   * present.
   */
  update = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const requester = { userId: req.userId!, role: req.userRole };
      const sessionId = req.params.id as string;

      const session =
        req.body?.status === 'ended'
          ? await this.endLiveSessionUseCase.execute(sessionId, requester)
          : await this.updateLiveSessionPrivacyUseCase.execute(
              sessionId,
              req.body,
              requester
            );

      res.json({
        data: session,
        message: req.body?.status === 'ended'
          ? 'Live session ended'
          : 'Live session updated',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  /** POST /live-sessions/:id/overlay-token/rotate — mint a new token (owner/admin). */
  rotateToken = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const session = await this.rotateOverlayTokenUseCase.execute(
        req.params.id as string,
        { userId: req.userId!, role: req.userRole }
      );
      res.json({
        data: session,
        message: 'Overlay token rotated',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /live-sessions/:id/public — public donor sheet. */
  getPublic = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const view = await this.getLiveSessionPublicUseCase.execute(
        req.params.id as string
      );
      if (!view) {
        throw new AppError('Live session not found', 404);
      }
      res.json({
        data: view,
        message: 'Live session retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /live-sessions/:id/overlay?token=… — token-gated overlay payload. */
  getOverlay = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = firstQueryValue(req.query.token);
      const view = await this.getLiveSessionOverlayUseCase.execute(
        req.params.id as string,
        token
      );
      res.json({
        data: view,
        message: 'Overlay retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /live-sessions/:id/overlay/view — the OBS browser-source overlay page.
   *
   * Serves a static, self-contained HTML page (no server-side templating). The
   * page reads its overlay token from the query string and pulls live data from
   * the token-gated overlay JSON + SSE endpoints, so this handler needs no
   * session lookup and exposes no injection surface.
   */
  getOverlayView = (_req: Request, res: Response): void => {
    // This route serves a self-contained, trusted HTML page with an inline
    // script/style and the Outfit web font. The global helmet CSP
    // ("script-src 'self'") would block all of that, so relax the policy for
    // THIS response only. Safe because the page embeds no user-controlled data
    // (donor text arrives via fetch and is rendered with textContent, never
    // inlined into the HTML).
    // Allow the configured web app to embed this static overlay preview.
    const frameOrigins = config.corsOrigins.flatMap(origin => {
      try { const url = new URL(origin); return /^https?:$/.test(url.protocol) ? [url.origin] : []; } catch { return []; }
    });
    res.removeHeader('X-Frame-Options');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        `frame-ancestors 'self' ${frameOrigins.join(' ')}`,
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data:",
        "connect-src 'self'",
      ].join('; '),
    );
    res
      .type('html')
      .set('Referrer-Policy', 'no-referrer')
      .set('Cache-Control', 'public, max-age=300')
      .send(OVERLAY_PAGE_HTML);
  };
}
