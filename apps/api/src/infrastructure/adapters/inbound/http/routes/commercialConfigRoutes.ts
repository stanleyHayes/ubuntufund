import { Router, type Response, type NextFunction, type RequestHandler } from 'express';
import type { AuthenticatedRequest, createAuthMiddleware } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { CommercialConfigService } from '../../../../../application/services/CommercialConfigService.js';

/**
 * Admin-only commercial config (ADR-5): view the effective values + env
 * defaults, set an effective-dated override, and read a key's change history.
 * The versioned store IS the audit trail (who / when / why / value).
 */
export function createCommercialConfigRoutes(deps: {
  service: CommercialConfigService;
  authMiddleware: ReturnType<typeof createAuthMiddleware>;
  requireAdmin: RequestHandler;
}): Router {
  const router = Router();

  router.get(
    '/',
    deps.authMiddleware,
    deps.requireAdmin,
    async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const resolved = await deps.service.resolvePayoutsConfig();
        res.json({
          data: { resolved, defaults: deps.service.getDefaults(), keys: deps.service.keys },
          message: 'Commercial config',
          status: 200,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/:key/history',
    deps.authMiddleware,
    deps.requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const history = await deps.service.history(req.params.key as string);
        res.json({ data: history, message: 'Config history', status: 200 });
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    '/:key',
    deps.authMiddleware,
    deps.requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const key = req.params.key as string;
        if (!deps.service.isKnownKey(key)) {
          throw new AppError('Unknown commercial-config key.', 400);
        }
        const { value, effectiveFrom, reason } = req.body ?? {};
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
          throw new AppError('value must be a non-negative number.', 400);
        }
        const eff = effectiveFrom ? new Date(effectiveFrom) : new Date();
        if (Number.isNaN(eff.getTime())) {
          throw new AppError('effectiveFrom is not a valid date.', 400);
        }
        const version = await deps.service.setValue(key, value, req.userId!, eff, reason);
        res.json({ data: version, message: 'Commercial config updated', status: 200 });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
