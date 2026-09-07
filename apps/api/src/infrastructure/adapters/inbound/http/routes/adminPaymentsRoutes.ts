import { Router, type RequestHandler } from 'express';
import type { AdminPaymentsController } from '../controllers/AdminPaymentsController.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

/**
 * Admin payments + reconciliation resource (spec §15, §18). All admin-only:
 *   GET  /admin/payments              → search contributions
 *   GET  /admin/payments/:id          → end-to-end trace (contribution + attempts)
 *   POST /admin/payments/:id/reconcile→ re-verify + safely repair one
 *   POST /admin/reconciliation        → run the reconciliation sweep
 */
export function createAdminPaymentsRoutes(
  controller: AdminPaymentsController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  requireAdmin: RequestHandler
): Router {
  const router = Router();
  router.get('/payments', authMiddleware, requireAdmin, controller.search);
  router.get('/payments/:id', authMiddleware, requireAdmin, controller.timeline);
  router.post('/payments/:id/reconcile', authMiddleware, requireAdmin, controller.reconcileOne);
  router.post('/payments/:id/refund', authMiddleware, requireAdmin, controller.refund);
  router.post('/reconciliation', authMiddleware, requireAdmin, controller.runReconciliation);
  router.post('/reconciliation/payouts', authMiddleware, requireAdmin, controller.runPayoutReconciliation);
  return router;
}
