import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { StartLiveSessionUseCase } from '../../../../../application/use-cases/StartLiveSessionUseCase.js';
import type { EndLiveSessionUseCase } from '../../../../../application/use-cases/EndLiveSessionUseCase.js';
import type { UpdateLiveSessionPrivacyUseCase } from '../../../../../application/use-cases/UpdateLiveSessionPrivacyUseCase.js';
import type { RotateOverlayTokenUseCase } from '../../../../../application/use-cases/RotateOverlayTokenUseCase.js';
import type { GetLiveSessionPublicUseCase } from '../../../../../application/use-cases/GetLiveSessionPublicUseCase.js';
import type { GetLiveSessionOverlayUseCase } from '../../../../../application/use-cases/GetLiveSessionOverlayUseCase.js';
import { AppError } from '../../middleware/errorHandler.js';

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
    private readonly getLiveSessionOverlayUseCase: GetLiveSessionOverlayUseCase
  ) {}

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
}
