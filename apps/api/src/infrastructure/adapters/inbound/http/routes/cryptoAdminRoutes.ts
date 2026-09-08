import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from 'express';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import type { ReconcileCryptoUseCase } from '../../../../../application/use-cases/ReconcileCryptoUseCase.js';

/**
 * Admin crypto controls (Crypto Donations plan §14). Admin-only reconciliation
 * sweep over stuck PENDING/PROCESSING deposits — the manual replay/repair
 * control. Mounted at `/admin`.
 */
export function createCryptoAdminRoutes(
  reconcileCryptoUseCase: ReconcileCryptoUseCase,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  requireAdmin: RequestHandler
): Router {
  const router = Router();
  router.post(
    '/crypto/reconcile',
    authMiddleware,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = (req.body ?? {}) as { olderThanMinutes?: number };
        const summary = await reconcileCryptoUseCase.reconcileStale({
          olderThanMinutes: body.olderThanMinutes ?? 30,
        });
        res.json({ data: summary, status: 'success' });
      } catch (error) {
        next(error);
      }
    }
  );
  return router;
}
