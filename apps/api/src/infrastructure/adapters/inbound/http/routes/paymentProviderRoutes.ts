import { Router, type RequestHandler } from 'express';
import type { PaymentProviderController } from '../controllers/PaymentProviderController.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

/**
 * `requireAdmin` is accepted as a parameter (not implemented here) — see
 * ../../middleware/requireRole.ts for the actual middleware.
 */
export function createPaymentProviderRoutes(
  controller: PaymentProviderController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  requireAdmin: RequestHandler
): Router {
  const router = Router();

  // Public: enabled providers only.
  router.get('/enabled', controller.listEnabled);

  // Admin only: full provider list, including disabled ones.
  router.get('/', authMiddleware, requireAdmin, controller.listAll);

  // Admin only: flip a provider's enabled state.
  router.patch('/:id/toggle', authMiddleware, requireAdmin, controller.toggle);

  return router;
}
