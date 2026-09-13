import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import type { AdminPaymentsController } from '../controllers/AdminPaymentsController.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

const refundSchema = z.object({
  amount: z.number().finite().positive().optional(),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
});

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
  router.get('/refund-operations', authMiddleware, requireAdmin, controller.refundOperations);
  router.post('/refund-operations/:id/verify', authMiddleware, requireAdmin, validate(z.object({ providerReference: z.string().trim().regex(/^\d{1,30}$/).optional() })), controller.verifyRefund);
  router.post('/refund-operations/:id/retry-accounting', authMiddleware, requireAdmin, controller.retryRefundAccounting);
  router.get('/payments', authMiddleware, requireAdmin, controller.search);
  router.get('/payments/:id', authMiddleware, requireAdmin, controller.timeline);
  router.post('/payments/:id/reconcile', authMiddleware, requireAdmin, controller.reconcileOne);
  router.post('/payments/:id/refund', authMiddleware, requireAdmin, validate(refundSchema), controller.refund);
  router.post('/reconciliation', authMiddleware, requireAdmin, controller.runReconciliation);
  router.post('/reconciliation/payouts', authMiddleware, requireAdmin, controller.runPayoutReconciliation);
  return router;
}
