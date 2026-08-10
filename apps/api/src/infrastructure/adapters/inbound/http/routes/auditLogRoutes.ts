import { Router, type RequestHandler } from 'express';
import type { AuditLogController } from '../controllers/AuditLogController.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

export function createAuditLogRoutes(
  controller: AuditLogController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  requireAdmin: RequestHandler
): Router {
  const router = Router();
  router.get('/', authMiddleware, requireAdmin, controller.list);
  return router;
}
